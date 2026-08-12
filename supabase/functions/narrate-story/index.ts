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
const MODEL = "eleven_multilingual_v2";

/**
 * Bumped whenever the model or voice settings change.
 *
 * Cached audio is keyed by voice, so without this every story generated before
 * the change would keep its old narration and only new stories would sound
 * better — which would have looked like the fix not working.
 */
const RENDER_VERSION = "v2";

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
  stability: 0.7,
  similarity_boost: 0.8,
  style: 0,
  use_speaker_boost: false,
  speed: 0.9,
};

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

    const { storyId, voice = DEFAULT_VOICE } = (await req.json().catch(() => ({}))) as {
      storyId?: string;
      voice?: string;
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

    // Already paid for in this voice — hand back the cached copy.
    if (story.audio_url && story.audio_voice === renderTag) {
      return json({ audioUrl: story.audio_url, marks: story.audio_marks, cached: true }, 200);
    }

    const sentences = splitSentences(story.body);
    if (sentences.length === 0) return json({ error: "empty" }, 400);

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
      ? `catalogue/${slugify(story.title)}-${voice}-${RENDER_VERSION}.mp3`
      : `${user.id}/${storyId}-${voice}-${RENDER_VERSION}.mp3`;
    const audioUrl = `${supabaseUrl}/storage/v1/object/public/narration/${path}`;
    const marks = estimateMarks(sentences, 0.9);

    if (isCatalogue) {
      // Somebody has already paid for this one. Point this user's row at it
      // and return without touching ElevenLabs.
      const head = await fetch(audioUrl, { method: "HEAD" });
      if (head.ok) {
        await saveToMoment(supabaseUrl, serviceKey, storyId, audioUrl, renderTag, marks);
        console.log(`reused shared narration ${path}`);
        return json({ audioUrl, marks, cached: true }, 200);
      }
    }

    // Pauses are baked into the audio as SSML-style breaks, so the narration
    // breathes the same way whether it's played here or in a notification.
    const script = sentences.join(' <break time="0.9s" /> ');

    const speak = (settings: Record<string, number | boolean>) =>
      fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({ text: script, model_id: MODEL, voice_settings: settings }),
      });

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

    if (ttsRes.status === 401) {
      return json({ error: "bad_key", message: "The ElevenLabs key was rejected." }, 502);
    }
    if (ttsRes.status === 429) {
      return json({ error: "quota", message: "Narration quota reached for this month." }, 429);
    }
    if (!ttsRes.ok) {
      console.error("elevenlabs error", ttsRes.status, await ttsRes.text().catch(() => ""));
      return json({ error: "upstream_error", message: "Couldn't generate narration." }, 502);
    }

    const audio = new Uint8Array(await ttsRes.arrayBuffer());

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/narration/${path}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "audio/mpeg",
        "x-upsert": "true",
      },
      body: audio,
    });

    if (!uploadRes.ok) {
      console.error("upload failed", await uploadRes.text().catch(() => ""));
      return json({ error: "storage_error", message: "Couldn't save the narration." }, 500);
    }

    await saveToMoment(supabaseUrl, serviceKey, storyId, audioUrl, renderTag, marks);

    console.log(
      `narrated ${storyId} voice=${voice} chars=${script.length} shared=${isCatalogue}`,
    );
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

/** Start time per sentence, assuming even delivery plus the break between each. */
function estimateMarks(sentences: string[], breakSeconds: number): number[] {
  const WORDS_PER_SECOND = 2.4; // ~144wpm at speed 0.9
  const marks: number[] = [];
  let cursor = 0;
  for (const sentence of sentences) {
    marks.push(Number(cursor.toFixed(2)));
    const words = sentence.split(/\s+/).filter(Boolean).length;
    cursor += words / WORDS_PER_SECOND + breakSeconds;
  }
  return marks;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
