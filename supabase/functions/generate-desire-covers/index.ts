// Generates a small set of images for one dream, from the words the person
// actually wrote.
//
// The complaint this answers: "images are repeating so it feels normal, I need
// images to generate according to their dream." Both halves were true. There
// are thirty-two stock photographs in the app, four per theme, and most free
// text falls through to the same theme — so a feed of forty cards drew from a
// pool of four. Worse, they're the same four for every user of the app, which
// is the opposite of what a manifestation app is selling.
//
// The unit is the DREAM, not the story. That distinction is the whole design:
//
// - Per story would be right visually and wrong financially. Forty-two stories
//   are written per refresh, most never opened, at four cents each. That is
//   more per day than the subscription costs per month.
// - Per dream is affordable and permanent. Six images at four cents is
//   twenty-four cents once, for a dream someone will look at for months.
//
// Six rather than one because one image repeated across a dream's stories is
// still repetition — just better-targeted repetition. Each of the six is set
// somewhere different, matching the scenes the stories themselves are set in,
// so a story that takes place in a kitchen at night has a kitchen at night on
// its cover.
//
// Required secret: OPENAI_API_KEY

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * The settings, in the same order as the story writer's list.
 *
 * Shared order is what makes cover and story agree. `ai-moment` picks its
 * setting from an equivalent list, so image N and story N describe the same
 * place.
 */
const SCENES = [
  "a kitchen at night, lit only by one lamp, everyone else asleep",
  "the window seat of a train at dusk, fields going past",
  "an empty park bench in the middle of the afternoon",
  "a street at dusk in winter, walking home, breath visible",
  "a doorway with keys still in the lock, bag on the floor",
  "a quiet stairwell with light coming from a landing above",
  "an unmade bed in early blue morning light before the alarm",
  "a balcony step in the first warm evening of the year",
];

/**
 * How many to make per dream.
 *
 * Was six. Six images is twenty-four cents, and with several dreams that is
 * real money against a balance that ran out and took every text feature down
 * with it — the story writer, the affirmations, the daily action and the
 * milestones all share one OpenAI account.
 *
 * Two is enough to stop a dream's feed looking like one repeated picture,
 * which was the original complaint. The stock photographs fill the rest.
 */
const DEFAULT_COUNT = 2;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "not_configured" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);

    const { desireId, count = DEFAULT_COUNT } = (await req.json().catch(() => ({}))) as {
      desireId?: string;
      count?: number;
    };
    if (!desireId) return json({ error: "bad_request", message: "No dream given." }, 400);

    // Read as the user, so RLS confirms the dream is theirs.
    const desireRes = await fetch(
      `${supabaseUrl}/rest/v1/desires?select=id,title,description,category&id=eq.${encodeURIComponent(desireId)}&limit=1`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    if (!desireRes.ok) return json({ error: "not_found" }, 404);
    const rows = (await desireRes.json()) as {
      id: string;
      title: string;
      description: string | null;
      category: string | null;
    }[];
    const desire = rows[0];
    if (!desire) return json({ error: "not_found" }, 404);

    const wanted = Math.max(1, Math.min(SCENES.length, count));
    let made = 0;
    let skipped = 0;

    for (let index = 0; index < wanted; index += 1) {
      const path = `covers/desire/${desireId}/${index}.png`;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/vision/${path}`;

      // Already paid for. This is what makes the endpoint safe to call on every
      // visit rather than needing a flag on the row.
      const head = await fetch(publicUrl, { method: "HEAD" });
      if (head.ok) {
        skipped += 1;
        continue;
      }

      const prompt = promptFor(desire.title, desire.description, SCENES[index]!);

      const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          size: "1024x1024",
          quality: "medium",
          n: 1,
        }),
      });

      if (imageRes.status === 429) {
        // Stop rather than hammering. What's already made stays made, and the
        // next visit picks up where this left off.
        console.warn(`rate limited after ${made} images for ${desireId}`);
        break;
      }
      if (!imageRes.ok) {
        console.error("image error", imageRes.status, await imageRes.text().catch(() => ""));
        break;
      }

      const payload = (await imageRes.json()) as { data?: { b64_json?: string }[] };
      const b64 = payload.data?.[0]?.b64_json;
      if (!b64) {
        console.error("no image data returned");
        break;
      }

      const uploaded = await fetch(`${supabaseUrl}/storage/v1/object/vision/${path}`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "image/png",
          "x-upsert": "true",
        },
        body: decodeBase64(b64),
      });

      if (!uploaded.ok) {
        console.error("upload failed", await uploaded.text().catch(() => ""));
        break;
      }
      made += 1;
    }

    console.log(`desire covers ${desireId} made=${made} existing=${skipped}`);
    return json({ made, existing: skipped, total: made + skipped }, 200);
  } catch (error) {
    console.error("generate-desire-covers failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

/**
 * The image prompt.
 *
 * Two rules do most of the work here.
 *
 * No people, because a photograph of someone else's face is the fastest way to
 * make a scene feel like stock imagery of somebody else's life. An empty room
 * leaves space for the person looking at it.
 *
 * No text, symbols or literal depictions of the goal. A dream about money
 * should not produce a picture of banknotes — that reads as a bank advert and
 * it's the visual equivalent of the "money is flowing to me" affirmations we
 * already took out. The image carries the mood of having got there, not the
 * prize.
 */
function promptFor(title: string, description: string | null, scene: string): string {
  const dream = [title, description].filter(Boolean).join(". ");
  return [
    `A quiet, photographic scene: ${scene}.`,
    `The mood is that of someone for whom this is already true: ${dream}.`,
    "Natural available light, muted and warm, shallow depth of field, film grain.",
    "No people, no faces, no hands.",
    "No text, letters, numbers, logos or symbols anywhere in the image.",
    "Do not literally depict the goal or any object representing wealth, prizes or trophies.",
    "It should look like an unposed photograph someone took of an ordinary moment.",
  ].join(" ");
}

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
