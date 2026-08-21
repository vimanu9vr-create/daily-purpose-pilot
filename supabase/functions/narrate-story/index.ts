// Generates real narration audio for a story using ElevenLabs, and caches it.
//
// Cost control is the whole design here. ElevenLabs bills per character, so a
// story is generated exactly once: the MP3 goes into Supabase Storage and the
// URL is written back onto the row. Replays, other devices and the morning
// notification all reuse it. Re-generating only happens if the story text or
// the chosen voice changes.
//
// Required secret: ELEVENLABS_API_KEY

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** ElevenLabs stock voices. Sarah is the calm, warm one. */
const VOICES: Record<string, string> = {
  sarah: "EXAVITQu4vr4xnSDxMaL",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  charlotte: "XB0fDUnXU5powFXDhCwa",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  george: "JBFqnCBsd6RMkjVDRZzb",
};

const DEFAULT_VOICE = "sarah";

// See NOTES.md §1.
// See NOTES.md §2.
const OUTPUT_FORMAT = "mp3_44100_64";

// See NOTES.md §3.
const MODEL = Deno.env.get("NARRATION_MODEL") ?? "eleven_flash_v2_5";

// See NOTES.md §4.
const RENDER_VERSION = "v7";

// See NOTES.md §5.
const VOICE_SETTINGS = {
  // Very high stability is what stops the voice "performing". Human readers
  // add emphasis to hold attention; a voice that sounds like it is speaking
  // from somewhere rather than to you does the opposite — it stays level and
  // lets the words land on their own.
  stability: 0.85,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: false,
  // See NOTES.md §6.
  speed: 0.7,
};

// See NOTES.md §7.
const BREAK_SECONDS = 2.4;

// See NOTES.md §8.
const OPENING_SENTENCES = 2;

// See NOTES.md §9.
type Tier = "free" | "standard" | "voice";

const NARRATION_ALLOWANCE: Record<Tier, { perDay: number; perMonth: number; total: number | null }> =
  {
    free: { perDay: 1, perMonth: 3, total: 3 },
    standard: { perDay: 0, perMonth: 0, total: 0 },
    voice: { perDay: 3, perMonth: 45, total: null },
  };

/**
 * Mirror of `tierOf` in src/features/billing/plans.ts.
 *
 * Duplicated rather than shared because an edge function cannot import from the
 * app bundle. The rule that matters is that THIS copy is the one that decides —
 * the client's copy only controls what gets drawn on screen. A gate that lives
 * on the client is a suggestion.
 */
function tierOf(plan: string | null | undefined): Tier {
  switch (plan) {
    case "standard_monthly":
    case "standard_yearly":
    case "standard_lifetime":
      return "standard";
    case "voice_monthly":
    case "voice_yearly":
    // Sold before the split, with narration included. They keep it.
    case "monthly":
    case "yearly":
    case "lifetime":
      return "voice";
    default:
      return "free";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return json(
        { error: "not_configured", message: "Studio narration isn't switched on yet." },
        503,
      );
    }

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
      storyId,
      voice = DEFAULT_VOICE,
      part,
      force = false,
    } = (await req.json().catch(() => ({}))) as {
      storyId?: string;
      voice?: string;
      /** "opening" for the first lines, "rest" for everything after. Omit for the whole thing. */
      part?: "opening" | "rest";
      /** Re-render even though usable audio exists. Costs money; ask first. */
      force?: boolean;
    };
    if (!storyId) return json({ error: "bad_request", message: "No story given." }, 400);

    const voiceId = VOICES[voice.toLowerCase()] ?? VOICES[DEFAULT_VOICE]!;
    // What gets stored and compared against, so a settings change invalidates
    // every cached file rather than only affecting new stories.
    const renderTag = `${voice}@${RENDER_VERSION}`;

    // Read the story as the user, so RLS confirms they own it.
    const storyRes = await fetch(
      `${supabaseUrl}/rest/v1/moments?select=id,body,title,source,audio_url,audio_voice,audio_marks&id=eq.${encodeURIComponent(storyId)}`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    if (!storyRes.ok) return json({ error: "not_found" }, 404);
    const rows = (await storyRes.json()) as {
      id: string;
      body: string;
      title: string;
      source: string;
      audio_url: string | null;
      audio_voice: string | null;
      audio_marks: unknown;
    }[];
    const story = rows[0];
    if (!story) return json({ error: "not_found" }, 404);

    // See NOTES.md §10.
    if (!part && story.audio_url && story.audio_voice?.startsWith(`${voice}@`) && !force) {
      const staleVersion = story.audio_voice !== renderTag;
      if (staleVersion) console.log(`reusing ${story.audio_voice} rather than re-rendering`);
      return json({ audioUrl: story.audio_url, marks: story.audio_marks, cached: true }, 200);
    }

    const allSentences = splitSentences(story.body);
    if (allSentences.length === 0) return json({ error: "empty" }, 400);

    const sentences =
      part === "opening"
        ? allSentences.slice(0, OPENING_SENTENCES)
        : part === "rest"
          ? allSentences.slice(OPENING_SENTENCES)
          : allSentences;

    // A story shorter than the opening has no remainder. Say so rather than
    // billing for an empty generation.
    if (sentences.length === 0) return json({ audioUrl: null, marks: [], empty: true }, 200);

    const partSuffix = part ? `-${part}` : "";

    // See NOTES.md §11.
    const isCatalogue = story.source === "catalogue";
    const path = isCatalogue
      ? `catalogue/${slugify(story.title)}-${voice}-${RENDER_VERSION}${partSuffix}.mp3`
      : `${user.id}/${storyId}-${voice}-${RENDER_VERSION}${partSuffix}.mp3`;
    // Older renders of the same track, newest first. A file from v5 is still
    // Sarah reading the same words, and reusing it costs nothing.
    const olderPaths = isCatalogue
      ? ["v6", "v5", "v4", "v3"].map(
          (v) => `catalogue/${slugify(story.title)}-${voice}-${v}${partSuffix}.mp3`,
        )
      : [];
    const audioUrl = `${supabaseUrl}/storage/v1/object/public/narration/${path}`;

    // See NOTES.md §12.
    const marksPath = `${path.replace(/\.mp3$/, "")}.marks.json`;
    const marksUrl = `${supabaseUrl}/storage/v1/object/public/narration/${marksPath}`;

    if (part) {
      const head = await fetch(audioUrl, { method: "HEAD" });
      if (head.ok) {
        const marksRes = await fetch(marksUrl);
        const cachedMarks = marksRes.ok ? ((await marksRes.json()) as number[]) : [];
        console.log(`reused ${part} ${path}`);
        return json({ audioUrl, marks: cachedMarks, cached: true }, 200);
      }
    }

    if (isCatalogue && !part && !force) {
      // See NOTES.md §13.
      let found = audioUrl;
      let head = await fetch(audioUrl, { method: "HEAD" });
      for (const older of olderPaths) {
        if (head.ok) break;
        const olderUrl = `${supabaseUrl}/storage/v1/object/public/narration/${older}`;
        head = await fetch(olderUrl, { method: "HEAD" });
        if (head.ok) {
          found = olderUrl;
          console.log(`reusing an older render: ${older}`);
        }
      }
      if (head.ok) {
        const audioUrlToUse = found;
        // Another user already paid for this track. Their row has the real
        // marks; read them rather than estimating, so the second listener gets
        // the same sync as the first.
        const sharedRes = await fetch(
          `${supabaseUrl}/rest/v1/moments?select=audio_marks&audio_url=eq.${encodeURIComponent(audioUrlToUse)}&audio_marks=not.is.null&limit=1`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        );
        const sharedRows = sharedRes.ok ? await sharedRes.json() : [];
        const sharedMarks = Array.isArray(sharedRows) ? sharedRows[0]?.audio_marks : null;
        const reused = Array.isArray(sharedMarks) ? (sharedMarks as number[]) : [];
        await saveToMoment(supabaseUrl, serviceKey, storyId, audioUrlToUse, renderTag, reused);
        console.log(`reused shared narration ${audioUrlToUse} marks=${reused.length}`);
        return json({ audioUrl: audioUrlToUse, marks: reused, cached: true }, 200);
      }
    }

    // Pauses are baked into the audio as SSML-style breaks, so the narration
    // breathes the same way whether it's played here or in a notification.
    const joiner = ` <break time="${BREAK_SECONDS}s" /> `;
    const script = sentences.join(joiner);

    // See NOTES.md §14.
    if (!isCatalogue) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const startOfMonth = new Date(startOfDay);
      startOfMonth.setUTCDate(1);

      /**
       * Count without downloading the rows.
       *
       * `Prefer: count=exact` with a one-row window makes Postgres return the
       * total in the Content-Range header. The lifetime count for a long-lived
       * voice subscriber is in the hundreds; fetching all of them to call
       * `.length` on the array would get slower every month the account exists.
       */
      const countSpend = async (since: Date | null): Promise<number> => {
        const window = since ? `&created_at=gte.${since.toISOString()}` : "";
        const res = await fetch(
          `${supabaseUrl}/rest/v1/narration_spend?select=id&user_id=eq.${user.id}&billed=is.true${window}`,
          {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              Prefer: "count=exact",
              Range: "0-0",
            },
          },
        );
        const total = res.headers.get("content-range")?.split("/")[1];
        return total && total !== "*" ? Number(total) : 0;
      };

      const [subRes, today, month, ever] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/subscriptions?select=plan,status&user_id=eq.${user.id}` +
            `&status=in.("active","trialing")&limit=1`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        ),
        countSpend(startOfDay),
        countSpend(startOfMonth),
        countSpend(null),
      ]);

      const subs = subRes.ok ? ((await subRes.json()) as { plan?: string }[]) : [];
      const tier = tierOf(subs[0]?.plan);
      const allowance = NARRATION_ALLOWANCE[tier];

      /**
       * Standard doesn't include narration at all, and this is not a limit
       * they've hit — it's a thing they didn't buy. Different error, different
       * status, different screen: 402 with an offer, not 429 with "come back
       * tomorrow", which would be a lie since tomorrow changes nothing.
       */
      if (allowance.perDay === 0) {
        console.log(`voice not in plan user=${user.id} tier=${tier}`);
        return json(
          {
            error: "voice_not_included",
            message:
              "Your plan covers everything written. The narrated voice is on the Voice plan.",
            tier,
          },
          402,
        );
      }

      const over =
        today >= allowance.perDay
          ? { window: "day", spent: today, allowance: allowance.perDay }
          : month >= allowance.perMonth
            ? { window: "month", spent: month, allowance: allowance.perMonth }
            : allowance.total !== null && ever >= allowance.total
              ? { window: "total", spent: ever, allowance: allowance.total }
              : null;

      if (over) {
        console.log(
          `cap reached user=${user.id} tier=${tier} window=${over.window} ` +
            `spent=${over.spent} allowance=${over.allowance}`,
        );

        /**
         * Three different sentences because three different things are true,
         * and a person can tell when a message doesn't match their situation.
         * Telling a free user whose trial is spent that "it resets at midnight"
         * would have them come back tomorrow to nothing.
         */
        const message =
          over.window === "total"
            ? "That's the last of your free narrations. The Voice plan opens them up properly."
            : over.window === "month"
              ? "That's this month's narration used. It resets on the first — every story is still here to read."
              : tier === "free"
                ? "That's today's free narration. You can still read every story, and it resets at midnight."
                : "That's today's three narrations. The words are all here to read, and it resets at midnight.";

        return json(
          {
            error: over.window === "total" ? "trial_used" : "daily_limit",
            message,
            window: over.window,
            spent: over.spent,
            allowance: over.allowance,
            tier,
          },
          429,
        );
      }
    }

    // See NOTES.md §15.
    const CONTEXT_CHARS = 400;
    const previousText =
      part === "rest"
        ? allSentences.slice(0, OPENING_SENTENCES).join(" ").slice(-CONTEXT_CHARS)
        : "";
    const nextText =
      part === "opening"
        ? allSentences.slice(OPENING_SENTENCES).join(" ").slice(0, CONTEXT_CHARS)
        : "";

    // Where each sentence starts inside `script`, so the returned per-character
    // times can be turned back into per-sentence times.
    const sentenceOffsets: number[] = [];
    let cursor = 0;
    for (const sentence of sentences) {
      sentenceOffsets.push(cursor);
      cursor += sentence.length + joiner.length;
    }

    // See NOTES.md §16.
    const speak = (settings: Record<string, number | boolean>) =>
      fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${OUTPUT_FORMAT}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            text: script,
            model_id: MODEL,
            voice_settings: settings,
            ...(previousText ? { previous_text: previousText } : {}),
            ...(nextText ? { next_text: nextText } : {}),
          }),
        },
      );

    let ttsRes = await speak(VOICE_SETTINGS);

    // `speed` isn't accepted on every model, and which models take it has
    // changed more than once. Rather than hardcode an assumption that quietly
    // breaks narration later, drop it and retry — slightly faster delivery is
    // a far better outcome than no audio at all.
    if (ttsRes.status === 422) {
      console.warn("retrying without speed; model rejected the setting");
      const { speed: _speed, ...withoutSpeed } = VOICE_SETTINGS;
      ttsRes = await speak(withoutSpeed);
    }

    // See NOTES.md §17.
    if (ttsRes.status === 401 || ttsRes.status === 403) {
      const reason = await ttsRes.text().catch(() => "");
      console.error(`elevenlabs rejected us: ${ttsRes.status}`, reason.slice(0, 500));

      const spent = /quota|exceeded|credit|limit/i.test(reason);
      return json(
        {
          error: spent ? "quota" : "bad_key",
          message: spent
            ? "The narration allowance for this month is used up."
            : "The ElevenLabs key was rejected.",
          detail: reason.slice(0, 200),
        },
        spent ? 429 : 502,
      );
    }
    if (ttsRes.status === 429) {
      const reason = await ttsRes.text().catch(() => "");
      console.error("elevenlabs 429", reason.slice(0, 500));
      return json({ error: "quota", message: "Narration quota reached for this month." }, 429);
    }
    if (!ttsRes.ok) {
      console.error("elevenlabs error", ttsRes.status, await ttsRes.text().catch(() => ""));
      return json({ error: "upstream_error", message: "Couldn't generate narration." }, 502);
    }

    const spoken = (await ttsRes.json()) as {
      audio_base64?: string;
      alignment?: { characters?: string[]; character_start_times_seconds?: number[] } | null;
    };

    if (!spoken.audio_base64) {
      console.error("no audio in timestamped response");
      return json({ error: "upstream_error", message: "Couldn't generate narration." }, 502);
    }

    const audio = decodeBase64(spoken.audio_base64);
    const marks = marksFromAlignment(script, sentenceOffsets, spoken.alignment ?? null, sentences);

    const uploaded = await uploadToStorage(supabaseUrl, serviceKey, path, audio, "audio/mpeg");
    if (!uploaded) {
      return json({ error: "storage_error", message: "Couldn't save the narration." }, 500);
    }

    if (part) {
      // Parts keep their timings beside the audio; only the whole story is
      // recorded on the row, so a half-finished play can't leave the row
      // pointing at two sentences of narration.
      await uploadToStorage(
        supabaseUrl,
        serviceKey,
        marksPath,
        new TextEncoder().encode(JSON.stringify(marks)),
        "application/json",
      );
    } else {
      await saveToMoment(supabaseUrl, serviceKey, storyId, audioUrl, renderTag, marks);
    }

    // See NOTES.md §18.
    await fetch(`${supabaseUrl}/rest/v1/narration_spend`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: user.id,
        moment_id: storyId,
        characters: script.length,
        billed: true,
      }),
    }).catch((error) => console.error("could not record spend", error));

    console.log(`narrated ${storyId} voice=${voice} chars=${script.length} shared=${isCatalogue}`);
    return json({ audioUrl, marks, cached: false }, 200);
  } catch (error) {
    console.error("narrate-story failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

/** Stable file name from a track title: "Put the day down" -> put-the-day-down. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uploadToStorage(
  supabaseUrl: string,
  serviceKey: string,
  path: string,
  body: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/narration/${path}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) console.error("upload failed", path, await res.text().catch(() => ""));
  return res.ok;
}

async function saveToMoment(
  supabaseUrl: string,
  serviceKey: string,
  storyId: string,
  audioUrl: string,
  voice: string,
  marks: number[],
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/moments?id=eq.${encodeURIComponent(storyId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ audio_url: audioUrl, audio_voice: voice, audio_marks: marks }),
  });
}

function splitSentences(body: string): string[] {
  return body
    .split(/\n\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Base64 to bytes, without pulling in a dependency for four lines. */
function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// See NOTES.md §19.
function marksFromAlignment(
  script: string,
  offsets: number[],
  alignment: { characters?: string[]; character_start_times_seconds?: number[] } | null,
  sentences: string[],
): number[] {
  const times = alignment?.character_start_times_seconds;
  if (!times || times.length === 0) {
    // No alignment came back. Return nothing rather than inventing times: the
    // player treats an empty list as "don't advance the highlight", which is
    // honest. Guessing is what produced the bug this replaces.
    console.warn(`no alignment returned for ${sentences.length} sentences`);
    return [];
  }

  const scale = times.length / Math.max(1, script.length);
  return offsets.map((offset) => {
    const index = Math.min(times.length - 1, Math.max(0, Math.round(offset * scale)));
    return Number((times[index] ?? 0).toFixed(2));
  });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
