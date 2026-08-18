// Narrates the library tracks up front, so nobody is the first person to wait.
//
// ## Why this exists
//
// Thirty of the thirty-five catalogue tracks had no audio at all. Sleep was 0
// of 3 and meditation 0 of 4 — both named on the landing page and sold in the
// paid tier. Tapping "Falling Softly, 18 min" produced silence, which is a
// worse first impression than any story-quality problem, and it had been true
// since the day they were seeded.
//
// The app narrates on demand, which is right for a personal story nobody else
// will ever hear. It is wrong for a fixed library: the first person to open
// each track pays the wait, and until someone does, the track is broken.
//
// ## Why it calls narrate-story rather than ElevenLabs
//
// narrate-story already knows the voice, the model, the output format, the
// pacing, the sentence timings and the shared catalogue storage path. Copying
// any of that here would mean two places to change when the voice changes, and
// the copy would silently rot. This forwards the caller's token to that
// function and lets it do the work.
//
// Catalogue narration is stored per TITLE, not per user, so it is generated
// once for everyone. That also means duplicate rows with the same title cost
// nothing extra — the second one reuses the first one's file.
//
// ## Why it only does a few at a time
//
// Two reasons, and the second is the important one. An edge function has a
// wall-clock budget, and thirty tracks of narration will not fit in it.
//
// More to the point, this spends real money per character. A run that does
// everything in one unattended call is a run nobody can stop halfway. Small
// batches with a count of what is left make the spend visible and let it be
// abandoned after any batch.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** How many to narrate per call. Fits the time budget, keeps the spend visible. */
const DEFAULT_BATCH = 3;

/**
 * Which kinds to warm, in priority order when none is named.
 *
 * Sleep and meditation first because they are advertised by name and are the
 * two with no coverage at all. Affirmations are deliberately last: their bodies
 * are a short set of lines repeated to fill the runtime, so narrating them
 * verbatim pays several times over for the same words. That wants fixing before
 * it wants paying for.
 */
const DEFAULT_KINDS = ["sleep", "meditation", "frequency"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);

    const {
      kinds = DEFAULT_KINDS,
      batch = DEFAULT_BATCH,
      voice = "sarah",
    } = (await req.json().catch(() => ({}))) as {
      kinds?: string[];
      batch?: number;
      voice?: string;
    };

    const kindList = kinds.map((k) => `"${k}"`).join(",");
    const query =
      `select=id,title,kind,body&source=eq.catalogue&audio_url=is.null` +
      `&kind=in.(${kindList})&order=kind.asc,title.asc`;

    const listRes = await fetch(`${supabaseUrl}/rest/v1/moments?${query}`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!listRes.ok) return json({ error: "read_failed" }, 502);

    const silent = (await listRes.json()) as {
      id: string;
      title: string;
      kind: string;
      body: string;
    }[];

    if (silent.length === 0) {
      return json({ done: true, narrated: 0, remaining: 0, message: "Every track has audio." });
    }

    const wanted = Math.max(1, Math.min(silent.length, batch));
    const results: { title: string; kind: string; chars: number; ok: boolean; error?: string }[] =
      [];
    let charsSpent = 0;

    /**
     * One at a time, deliberately.
     *
     * Narration is minutes of audio per call and ElevenLabs is billed per
     * character; firing these in parallel would spend the whole batch before
     * the first failure is visible, and would be a burst that a rate limit is
     * entitled to refuse. Sequential is slower and stoppable.
     */
    for (const track of silent.slice(0, wanted)) {
      const res = await fetch(`${supabaseUrl}/functions/v1/narrate-story`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: track.id, voice }),
      });

      const ok = res.ok;
      if (ok) charsSpent += track.body.length;
      results.push({
        title: track.title,
        kind: track.kind,
        chars: track.body.length,
        ok,
        ...(ok ? {} : { error: (await res.text().catch(() => "")).slice(0, 160) }),
      });

      console.log(`prewarm ${track.kind} "${track.title}" ok=${ok} chars=${track.body.length}`);
    }

    const remaining = silent.length - results.filter((r) => r.ok).length;
    console.log(`prewarm batch done narrated=${charsSpent} chars remaining=${remaining} tracks`);

    return json({
      done: remaining === 0,
      narrated: results.filter((r) => r.ok).length,
      charsSpent,
      remaining,
      results,
    });
  } catch (error) {
    console.error("prewarm-catalogue failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
