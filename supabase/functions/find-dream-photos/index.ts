// Finds real photographs for one dream, from a free stock library.
//
// ## Why this replaces generating images
//
// Reported: "images are repeated, it feels frustrating — there are thousands of
// images from Google, use those so the API won't cost us."
//
// The instinct is right and one part of it isn't available. Google Images is a
// search index, not a licence: those photographs belong to whoever took them,
// and shipping them in an app would be copyright infringement and a Play Store
// rejection. There is no key you can get for it.
//
// But there are libraries built to be used this way. Pexels gives 20,000
// requests a month free, with up to 80 photographs per request, all licensed
// for commercial use. One request per dream therefore returns EIGHTY images
// matched to that dream's own words — against the two that AI generation could
// afford, and the four-per-theme the app shipped with.
//
// So: free, legal, and roughly forty times more variety than the thing it
// replaces. Generated art was the more original idea and this is the one that
// actually solves the complaint.
//
// Required secret: PEXELS_API_KEY (free at pexels.com/api)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** How many to keep. The API's maximum per request, and one request is enough. */
const WANTED = 80;

/**
 * Words that describe a photograph rather than a goal.
 *
 * Searching the dream verbatim gives literal results — "I want to buy defender
 * car" returns pictures of cars, which is the bank-advert problem the generated
 * images were written to avoid. Pairing the dream's own nouns with a mood term
 * returns the kind of quiet, ordinary scene the stories are set in.
 */
const MOODS = [
  "calm morning light",
  "quiet interior",
  "golden hour window",
  "empty road dusk",
  "soft home interior",
  "misty landscape",
  "warm lamplight evening",
  "still life window",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const apiKey = Deno.env.get("PEXELS_API_KEY");
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

    const { desireId } = (await req.json().catch(() => ({}))) as { desireId?: string };
    if (!desireId) return json({ error: "bad_request", message: "No dream given." }, 400);

    const path = `covers/desire/${desireId}/photos.json`;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/vision/${path}`;

    // Already found. One request per dream, ever.
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) return json({ cached: true, url: publicUrl }, 200);

    // Read as the user, so RLS confirms the dream is theirs.
    const desireRes = await fetch(
      `${supabaseUrl}/rest/v1/desires?select=id,title,category&id=eq.${encodeURIComponent(desireId)}&limit=1`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    if (!desireRes.ok) return json({ error: "not_found" }, 404);
    const [desire] = (await desireRes.json()) as {
      id: string;
      title: string;
      category: string | null;
    }[];
    if (!desire) return json({ error: "not_found" }, 404);

    const query = searchTermFor(desire.title, desire.category);

    const searchRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${WANTED}&orientation=portrait`,
      { headers: { Authorization: apiKey } },
    );

    if (!searchRes.ok) {
      console.error("pexels error", searchRes.status, await searchRes.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await searchRes.json()) as {
      photos?: { src?: { large?: string; portrait?: string } }[];
    };

    // `portrait` is already cropped to the shape of a story card, so the phone
    // isn't downloading a landscape photo to show a sliver of it.
    const urls = (payload.photos ?? [])
      .map((photo) => photo.src?.portrait ?? photo.src?.large)
      .filter((url): url is string => Boolean(url));

    if (urls.length === 0) return json({ error: "no_results", query }, 502);

    const saved = await fetch(`${supabaseUrl}/storage/v1/object/vision/${path}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "x-upsert": "true",
        "Cache-Control": "31536000",
      },
      body: JSON.stringify(urls),
    });

    if (!saved.ok) {
      console.error("save failed", await saved.text().catch(() => ""));
      return json({ error: "storage_error" }, 500);
    }

    console.log(`found ${urls.length} photos for ${desireId} query="${query}"`);
    return json({ found: urls.length, url: publicUrl, query }, 200);
  } catch (error) {
    console.error("find-dream-photos failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

/**
 * Turn a dream into something worth photographing.
 *
 * Strips the "I want to" scaffolding, keeps the person's own nouns, and adds a
 * mood term chosen from the dream itself so the same dream always searches the
 * same way. Without the mood term this returns catalogue photography of the
 * object; with it, it returns a room with light in it.
 */
function searchTermFor(title: string, category: string | null): string {
  const stripped = title
    .toLowerCase()
    .replace(/^(i want to|i want|i am|i'm|my aim is to|my goal is to|i wish to)\s+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(buy|get|have|make|earn|be|become)\b/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 3)
    .join(" ");

  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const mood = MOODS[Math.abs(hash) % MOODS.length]!;

  return [stripped || category || "calm", mood].join(" ").trim();
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
