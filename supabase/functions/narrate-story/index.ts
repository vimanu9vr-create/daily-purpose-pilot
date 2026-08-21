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

/**
 * Narration model.
 *
 * This was `eleven_turbo_v2_5`, which ElevenLabs now lists as deprecated and
 * describes as a low-latency model for real-time agents and chatbots. We were
 * using a model built for speed to read a meditation — and it sounded like it:
 * flatter, thinner, and slightly hurried, which is the opposite of calm.
 *
 * `eleven_multilingual_v2` is their recommendation for narration and long-form
 * content, and it's the one they describe as most stable across a long
 * generation. It costs more per character and takes a couple of seconds longer
 * to produce. Both are the right trade for something a person listens to with
 * their eyes closed, and neither is felt after the first play because the
 * result is cached forever.
 */
/**
 * Output format.
 *
 * Was `mp3_44100_128`. Reported as "it got stuck at 19 sec" on a frequency
 * track whose file is demonstrably complete — 47 sentences, 179 seconds, all
 * of it in storage. What ran out was the download, not the audio.
 *
 * 128kbps is a music bitrate. This is one voice, slowly, over a soft pad;
 * 64kbps is transparent for speech and halves the file. A three-minute track
 * goes from about 2.9MB to 1.4MB, which halves both the time before playback
 * can start and the chance of stalling part-way through on a phone connection.
 *
 * This is also the honest answer to "I need it to be fast". Generation time is
 * fixed by how much text there is, but transfer time is ours to choose, and we
 * had been paying double for a fidelity nobody can hear on a voice track.
 */
const OUTPUT_FORMAT = "mp3_44100_64";

/**
 * Which model reads it.
 *
 * `eleven_multilingual_v2` is ElevenLabs' recommendation for narration and the
 * one they describe as most stable across a long generation. It is also full
 * price per character.
 *
 * `eleven_flash_v2_5` is documented as "50% lower price per character for API
 * generations" — genuinely half the cost. It is built for real-time agents
 * rather than long-form reading, so it is faster and slightly less settled on
 * a three-minute piece.
 *
 * Default stays on quality. This app has been told its voice sounds wrong more
 * than once, and halving the bill by halving the thing people are paying for
 * is a trade worth making deliberately rather than quietly. `NARRATION_MODEL`
 * switches it without a deploy if the numbers ever demand it.
 */
const MODEL = Deno.env.get("NARRATION_MODEL") ?? "eleven_multilingual_v2";

/**
 * Bumped whenever the model, voice settings, or timing source change.
 *
 * v4 switched from estimated sentence times to real ones. v5 slowed the voice
 * to 0.7 and opened the gaps to 2.4s. v6 gives each half of a split narration
 * the text either side of it, so the two halves sound like one performance
 * instead of two.
 *
 * Every cached file was rendered under the old rules, so without the bump only
 * brand new tracks would change and the fix would look like it hadn't worked.
 *
 * Cached audio is keyed by voice, so without this every story generated before
 * the change would keep its old narration and only new stories would sound
 * better — which would have looked like the fix not working.
 */
const RENDER_VERSION = "v7";

/**
 * Settings tuned for calm rather than expressive.
 *
 * style at 0 is the important one: any amount of it makes the model perform
 * the line, and performance is what made this sound like an advert instead of
 * something to fall asleep to. Higher stability keeps the delivery even across
 * a long piece, and speaker boost is off because it adds a forward, present
 * quality that works for a voiceover and fights a bedtime story.
 */
const VOICE_SETTINGS = {
  // Very high stability is what stops the voice "performing". Human readers
  // add emphasis to hold attention; a voice that sounds like it is speaking
  // from somewhere rather than to you does the opposite — it stays level and
  // lets the words land on their own.
  stability: 0.85,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: false,
  /**
   * Slower than natural speech.
   *
   * Was 0.85, and reported back as still feeling fast — "it's not like the
   * universe is speaking". The logs confirmed 0.85 was genuinely being applied
   * rather than being rejected and silently dropped, so the setting was right
   * and the number was wrong.
   *
   * 0.7 is close to the floor of what stays natural; below it the model starts
   * to slur rather than slow. Most of the remaining effect comes from the
   * silence between sentences instead, which is the cheaper lever.
   */
  speed: 0.7,
};

/**
 * Silence between sentences.
 *
 * This single number does more for the feeling of space than any voice
 * setting. At 0.9s the narration reads like an audiobook. At 1.6s it reads
 * like something said into a large room. At 2.4s it stops sounding like
 * reading at all — the gap is long enough that each line arrives on its own
 * rather than as the next item in a list, and long enough for the ambient bed
 * to be heard underneath, which is where the atmosphere actually lives.
 *
 * It is also what makes a slow voice bearable: 0.7 speed with short gaps just
 * sounds sluggish. Slow delivery plus long silence sounds deliberate.
 */
const BREAK_SECONDS = 2.4;

/**
 * How much of the story gets generated first.
 *
 * The complaint: "voice starts playing after 40 secs, I need immediately
 * because it gets frustrating." That was accurate and it's a straight
 * consequence of the design — ElevenLabs was asked for the entire track, and
 * an eighteen-minute sleep script is thousands of characters. Nothing could
 * play until the last character was rendered.
 *
 * Nobody needs the last character to start listening. So the opening is
 * requested on its own and comes back in a few seconds, the player starts, and
 * the remainder is fetched underneath while those first lines are being read.
 *
 * Two sentences rather than one: a single sentence can be four words, which
 * would run out before the rest arrives. Two plus the 1.6s pause between them
 * buys roughly ten to fifteen seconds of cover, which is comfortably more than
 * the rest takes to render.
 */
const OPENING_SENTENCES = 2;

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

    /**
     * ANY existing audio in this voice is good enough. Not just this version.
     *
     * This used to require an exact match on `voice@RENDER_VERSION`, so every
     * time I changed a voice setting the entire library was invalidated and
     * re-rendered from scratch — and I bumped that constant four times in one
     * week tuning the pacing. Storage still holds five separate renders of
     * "abundance-888-hz", one per bump. Every one was paid for.
     *
     * The version exists so that a settings change reaches new audio. It was
     * never worth re-buying thousands of tracks that already sound fine, and
     * nobody listening can hear the difference between v6 and v7 anyway — they
     * can only hear the difference between audio and no audio.
     *
     * `force: true` re-renders deliberately, which is what the maintenance
     * page uses when a change is actually worth paying for.
     */
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

    /**
     * Sleep, meditation and frequency tracks are word-for-word identical for
     * every user, but each user gets their own `moments` row — so without this
     * we would pay ElevenLabs to narrate the same script once per person, and
     * every one of them would wait several seconds for audio that already
     * exists. That is both the loading complaint and the largest cost line.
     *
     * Personal stories still get their own file. Only the shared catalogue is
     * keyed by title rather than by user.
     */
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

    /**
     * Sentence times live beside the audio as a small JSON file.
     *
     * The whole-story marks are stored on the `moments` row, but a part has
     * nowhere to go there — and without somewhere to put them, a cached part
     * would have to be regenerated purely to recover its timings, which would
     * defeat the caching entirely. A few hundred bytes next to the mp3 is
     * cheaper than a schema change and doesn't need a migration.
     */
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
      /**
       * Somebody has already paid for this one. Point this user's row at it
       * and return without touching ElevenLabs.
       *
       * Older render versions count. A v5 file is Sarah reading the same
       * script; charging again for a marginally different pause length is how
       * five copies of "abundance-888-hz" ended up in storage.
       */
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

    /**
     * Tell the model what comes either side of this chunk.
     *
     * THIS IS THE FIX FOR "the voice first feels robotic and after some
     * seconds it goes fast."
     *
     * Splitting the narration in two made it start quickly, but it also meant
     * asking ElevenLabs for two unrelated performances. The opening is around
     * eighty characters — with no context at all, the model has nothing to
     * pitch against and delivers it flat and clipped, which is what "robotic"
     * is. The remainder is thousands of characters, so it settles into a
     * natural, flowing, noticeably quicker read. Two different voices, joined
     * fifteen seconds in.
     *
     * `previous_text` and `next_text` exist precisely for this: ElevenLabs
     * documents them as improving continuity when concatenating separate
     * generations. Giving the opening a glimpse of what follows, and the
     * remainder a glimpse of what preceded it, makes both halves sound like
     * one person reading one thing.
     *
     * Neither is spoken. They are context only.
     */
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

    /**
     * `/with-timestamps` rather than the plain endpoint.
     *
     * It returns the audio as base64 plus the start and end time of every
     * character, which is the whole point: the previous version guessed the
     * timings from a hardcoded 2.25 words per second, and a guess that is even
     * slightly wrong accumulates. By the twentieth sentence of a story the
     * highlighted line and the voice were seconds apart — reported as "voice
     * and wordings doesn't tally, voice goes fast".
     *
     * No estimate can fix that, because real delivery isn't uniform: Sarah
     * slows on long clauses, pauses at commas, and takes a different amount of
     * time on "no" than on "unremarkable". The only correct source for when a
     * sentence starts is the engine that spoke it.
     */
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

    /**
     * SAY WHY. This returned a bare 502 and logged nothing.
     *
     * Every narration request failed for a day and the only trace was
     * "POST | 502" in the edge log — no reason, nowhere. That is the same
     * mistake that cost a day on the Gemini side: the most common failure was
     * the one that recorded the least.
     *
     * It matters here because 401 from ElevenLabs is two different problems
     * wearing the same status. A revoked or rotated key needs a new key; a
     * spent monthly quota needs either waiting or a bigger plan. Telling them
     * apart is the difference between a two-minute fix and an afternoon.
     */
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

/**
 * Turn per-character times into the moment each sentence begins.
 *
 * ElevenLabs times every character it spoke. We know where each sentence
 * starts in the script we sent, so a sentence's start time is the time of the
 * character at that offset.
 *
 * The one wrinkle is that the returned character list doesn't always match the
 * text we sent one-for-one — SSML break tags and text normalisation ("20000cr"
 * becoming words) change the length. So when the lengths disagree, positions
 * are scaled proportionally instead. That is still enormously better than the
 * old estimate: it's anchored to the real total duration rather than to an
 * assumed reading speed, so error can't accumulate across a long story.
 */
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
