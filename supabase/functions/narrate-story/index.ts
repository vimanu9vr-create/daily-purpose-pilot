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
const MODEL = "eleven_turbo_v2_5";

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

    // Read the story as the user, so RLS confirms they own it.
    const storyRes = await fetch(
      `${supabaseUrl}/rest/v1/moments?select=id,body,audio_url,audio_voice,audio_marks&id=eq.${encodeURIComponent(storyId)}`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    if (!storyRes.ok) return json({ error: "not_found" }, 404);
    const rows = (await storyRes.json()) as {
      id: string;
      body: string;
      audio_url: string | null;
      audio_voice: string | null;
      audio_marks: unknown;
    }[];
    const story = rows[0];
    if (!story) return json({ error: "not_found" }, 404);

    // Already paid for in this voice — hand back the cached copy.
    if (story.audio_url && story.audio_voice === voice) {
      return json({ audioUrl: story.audio_url, marks: story.audio_marks, cached: true }, 200);
    }

    const sentences = splitSentences(story.body);
    if (sentences.length === 0) return json({ error: "empty" }, 400);

    // Pauses are baked into the audio as SSML-style breaks, so the narration
    // breathes the same way whether it's played here or in a notification.
    const script = sentences.join(' <break time="0.9s" /> ');

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: script,
          model_id: MODEL,
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.75,
            // Low style keeps it even and unhurried rather than performed.
            style: 0.15,
            use_speaker_boost: true,
            speed: 0.88,
          },
        }),
      },
    );

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
    const path = `${user.id}/${storyId}-${voice}.mp3`;

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

    const audioUrl = `${supabaseUrl}/storage/v1/object/public/narration/${path}`;

    // Estimated sentence start times. ElevenLabs can return exact character
    // timings from its with-timestamps endpoint, but that costs a second call;
    // proportional estimates track closely enough for line-by-line display.
    const marks = estimateMarks(sentences, 0.9);

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

    console.log(`narrated ${storyId} voice=${voice} chars=${script.length}`);
    return json({ audioUrl, marks, cached: false }, 200);
  } catch (error) {
    console.error("narrate-story failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

function splitSentences(body: string): string[] {
  return body
    .split(/\n\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Start time per sentence, assuming even delivery plus the break between each. */
function estimateMarks(sentences: string[], breakSeconds: number): number[] {
  const WORDS_PER_SECOND = 2.35; // ~140wpm at speed 0.88
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
