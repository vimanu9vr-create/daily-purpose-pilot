// Writes a new full-length library track: a meditation, a sleep session, or a
// visualisation. This is what stops the library being a fixed list of ten
// hand-written items and lets it grow week by week.
//
// Tracks are stored with source="catalogue" so the narration audio is shared
// by title across every user. The first person to play one pays for it; the
// rest get it instantly. That is what makes a growing library affordable.
//
// Required secret: OPENAI_API_KEY (falls back to LOVABLE_API_KEY)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

/**
 * Words needed for a given length.
 *
 * Sarah reads at about 135 words a minute, and there is a 1.6 second pause
 * between every sentence. A 10 minute track is therefore NOT 1350 words - the
 * pauses eat roughly a third of it. This is the number that was wrong when an
 * 18-minute sleep track shipped with 89 words in it, so it is calculated here
 * rather than guessed.
 */
function wordsFor(minutes: number): number {
  const speakingSeconds = minutes * 60 * 0.62; // the rest is silence
  return Math.round((speakingSeconds / 60) * 135);
}

function systemPrompt(kind: string, minutes: number): string {
  const words = wordsFor(minutes);

  const shared = `You write guided audio for a manifestation and wellbeing app. The script you write is read aloud by a calm female voice, slowly, with a 1.6 second silence after every sentence.

Length: about ${words} words. This matters - the track is labelled ${minutes} minutes and must genuinely fill it. Short scripts are the single worst failure here.

Voice and form:
- Second person, present tense. Short sentences. One idea per sentence, because each one is followed by silence.
- Plain, warm, unhurried. No exclamation marks, no emoji, no capitalised words, no stage directions.
- Concrete and sensory rather than abstract. "The room is quiet enough to hear the fridge" beats "you feel peaceful".
- Repetition is welcome. Returning to a phrase is how this kind of audio works.

Hard constraints:
- Never promise an outcome, a timeline, or a guarantee.
- Never imply that thinking or visualising causes external events. The honest mechanism is attention and follow-through.
- No medical, financial or legal claims. Nothing about curing, healing illness, or money arriving without work.
- Never tell the listener they are doing it wrong.`;

  const perKind: Record<string, string> = {
    meditation: `This is a MEDITATION. Arc: arrive and settle, attention on the breath or the body, one idea worked through slowly, then a return to the room. End awake, not asleep.`,
    sleep: `This is a SLEEP session. Arc: put the day down, release the body part by part, then drift. The second half should get slower, quieter and less demanding. Never ask a question near the end. End trailing off, not concluding.`,
    visualization: `This is a VISUALISATION. Arc: set the scene in ordinary detail, place the listener inside it doing something rather than receiving something, let them notice how it feels, then bring them back with one small thing to do today.`,
  };

  return `${shared}\n\n${perKind[kind] ?? perKind.meditation}\n\nReturn ONLY JSON: {"title":"...","hook":"...","body":"..."}. Title is 2-6 words, evocative, no colon. Hook is one sentence from the piece. Body uses \\n\\n between paragraphs. No markdown fence.`;
}

function resolveProvider(): { url: string; apiKey: string; model: string } | null {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey,
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
    };
  }
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) return { url: GATEWAY_URL, apiKey: lovableKey, model: FALLBACK_MODEL };
  return null;
}

const ALLOWED_KINDS = new Set(["meditation", "sleep", "visualization"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const provider = resolveProvider();
    if (!provider) return json({ error: "not_configured" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);
    const user = (await userRes.json()) as { id: string };

    const {
      kind = "meditation",
      theme,
      minutes = 10,
      category,
    } = (await req.json().catch(() => ({}))) as {
      kind?: string;
      theme?: string;
      minutes?: number;
      category?: string;
    };

    if (!ALLOWED_KINDS.has(kind)) return json({ error: "bad_kind" }, 400);
    if (!theme) return json({ error: "bad_request", message: "No theme given." }, 400);

    // Bounded so a crafted request can't ask for an hour of generation.
    const length = Math.min(20, Math.max(3, Math.round(minutes)));

    const aiRes = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt(kind, length) },
          { role: "user", content: `Theme: ${theme}` },
        ],
      }),
    });

    if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
    if (!aiRes.ok) {
      console.error("ai error", aiRes.status, await aiRes.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
    const track = parseTrack(payload.choices?.[0]?.message?.content ?? "");
    if (!track) return json({ error: "unparseable" }, 502);

    // Reject a script that can't fill its label. This is the check that was
    // missing when the catalogue shipped with 20% speech coverage.
    const wordCount = track.body.split(/\s+/).filter(Boolean).length;
    const minimum = Math.round(wordsFor(length) * 0.6);
    if (wordCount < minimum) {
      console.warn(`too short: ${wordCount} words, wanted ${minimum} for ${length} min`);
      return json({ error: "too_short", words: wordCount, wanted: minimum }, 502);
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/moments`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: user.id,
        title: track.title,
        hook: track.hook,
        body: track.body,
        category: category ?? null,
        kind: kind === "visualization" ? "meditation" : kind,
        duration_seconds: length * 60,
        source: "catalogue",
      }),
    });

    if (!insertRes.ok) {
      console.error("insert failed", await insertRes.text().catch(() => ""));
      return json({ error: "storage_error" }, 500);
    }

    const [saved] = (await insertRes.json()) as { id: string }[];
    console.log(`track written kind=${kind} minutes=${length} words=${wordCount}`);
    return json({ id: saved?.id, title: track.title, words: wordCount }, 200);
  } catch (error) {
    console.error("generate-track failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

function parseTrack(raw: string): { title: string; hook: string; body: string } | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { title?: string; hook?: string; body?: string };
    if (!parsed.title?.trim() || !parsed.body?.trim()) return null;
    return {
      title: parsed.title.trim().slice(0, 80),
      hook: (parsed.hook ?? parsed.title).trim().slice(0, 160),
      body: parsed.body.trim(),
    };
  } catch {
    return null;
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
