// Speaks a short piece of text in Sarah's voice, and caches it by content.
//
// Why this exists: the story player has used ElevenLabs for weeks, but the
// affirmations screen and Today's Moment were still calling the browser's own
// speech synthesis — the flat robotic voice. Two of the three places a person
// presses play were never using the voice the app is built around.
//
// The story path caches per row, which is wrong for a single line. Affirmations
// repeat heavily: the same sentence appears in many users' libraries, and the
// same user replays one line dozens of times. So this caches by a hash of the
// text itself. Identical words are generated once, ever, across every user —
// the first person to play a line pays for it and everyone after is instant.
//
// Required secret: ELEVENLABS_API_KEY

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VOICES: Record<string, string> = {
  sarah: "EXAVITQu4vr4xnSDxMaL",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  charlotte: "XB0fDUnXU5powFXDhCwa",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  george: "JBFqnCBsd6RMkjVDRZzb",
};

const DEFAULT_VOICE = "sarah";
const MODEL = "eleven_multilingual_v2";

/** Bump to invalidate every cached line at once. Mirrors narrate-story. */
const RENDER_VERSION = "v2";

/**
 * Deliberately identical to narrate-story's settings.
 *
 * If an affirmation sounds different from a story, the app has two voices and
 * neither feels like a person. Same voice, same stability, same slowness —
 * which means this file has to be changed every time that one is. v2 follows
 * narrate-story down to 0.7 speed and 2.4s gaps.
 */
const VOICE_SETTINGS = {
  stability: 0.85,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: false,
  speed: 0.7,
};

/**
 * Space between sentences, matching the story narration.
 *
 * An affirmation is usually one sentence, so this mostly does nothing — but
 * Today's Moment is several, and without it they run together.
 */
const BREAK_SECONDS = 2.4;

/**
 * Hard ceiling on what counts as a "line".
 *
 * This endpoint has no per-row cost tracking, so an unbounded text field is an
 * unbounded ElevenLabs bill. Anything longer than this is a story and belongs
 * in narrate-story, which caches against a row someone owns.
 */
const MAX_CHARS = 1500;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return json({ error: "not_configured", message: "The studio voice isn't switched on." }, 503);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Signed in, but nothing here is per-user — the cache is global on purpose.
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);

    const { text, voice = DEFAULT_VOICE } = (await req.json().catch(() => ({}))) as {
      text?: string;
      voice?: string;
    };

    const clean = (text ?? "").trim();
    if (!clean) return json({ error: "bad_request", message: "Nothing to say." }, 400);
    if (clean.length > MAX_CHARS) {
      return json({ error: "too_long", message: "That's too long to read as a line." }, 400);
    }

    const voiceKey = voice.toLowerCase();
    const voiceId = VOICES[voiceKey] ?? VOICES[DEFAULT_VOICE]!;

    // The cache key is the words themselves, so the same affirmation in two
    // different people's libraries is one file.
    const hash = await sha256(`${RENDER_VERSION}|${voiceKey}|${clean}`);
    const path = `lines/${hash}.mp3`;
    const audioUrl = `${supabaseUrl}/storage/v1/object/public/narration/${path}`;

    const head = await fetch(audioUrl, { method: "HEAD" });
    if (head.ok) return json({ audioUrl, cached: true }, 200);

    const sentences = clean
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const script = (sentences.length > 0 ? sentences : [clean]).join(
      ` <break time="${BREAK_SECONDS}s" /> `,
    );

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
    if (ttsRes.status === 422) {
      // Same guard as narrate-story: `speed` isn't accepted on every model, and
      // slightly quicker delivery beats no audio.
      console.warn("retrying without speed; model rejected the setting");
      const { speed: _speed, ...withoutSpeed } = VOICE_SETTINGS;
      ttsRes = await speak(withoutSpeed);
    }

    if (ttsRes.status === 401) {
      return json({ error: "bad_key", message: "The ElevenLabs key was rejected." }, 502);
    }
    if (ttsRes.status === 429) {
      return json({ error: "quota", message: "Voice quota reached for this month." }, 429);
    }
    if (!ttsRes.ok) {
      console.error("elevenlabs error", ttsRes.status, await ttsRes.text().catch(() => ""));
      return json({ error: "upstream_error", message: "Couldn't generate that." }, 502);
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
      return json({ error: "storage_error", message: "Couldn't save that." }, 500);
    }

    console.log(`spoke line hash=${hash} chars=${script.length} voice=${voiceKey}`);
    return json({ audioUrl, cached: false }, 200);
  } catch (error) {
    console.error("speak-line failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
