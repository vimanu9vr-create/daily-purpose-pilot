// Generates a cover image for a track or story from what it is actually about.
//
// COST, AND WHY IT IS SHAPED THIS WAY.
//
// Images cost roughly four cents. Generating one for all 42 personal stories
// the moment they are written would be about $1.70 per user per refresh - more
// than the subscription, every four hours. So this is LAZY: a story only gets
// a generated cover when somebody actually opens it. Most stories are never
// opened, so the bill tracks real listening rather than browsing, which is the
// same principle the narration audio already uses.
//
// Library tracks are shared by title across every user, so those are generated
// once for everybody.
//
// Required secret: OPENAI_API_KEY

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * The house style.
 *
 * Held constant so a feed of thirty covers looks like one app rather than
 * thirty stock photos. Warm, soft-focus, golden-hour photography of people and
 * places - and explicitly never text, symbols or anything that reads as
 * generated, because the moment a cover looks like AI output the whole thing
 * feels cheap.
 */
const STYLE =
  "Soft-focus editorial photograph, warm natural light, golden hour, muted rose and amber palette, shallow depth of field, subtle film grain, calm and aspirational, shot on 35mm. Photorealistic. No text, no words, no letters, no numbers, no logos, no watermarks, no collage, no illustration, no 3D render, no digital art.";

function buildPrompt(title: string, hook: string): string {
  // The hook is a real line from the piece, so it carries the imagery. A title
  // on its own produces something literal and lifeless.
  const subject = `${title}. ${hook}`.slice(0, 400);
  return `A single evocative scene that captures the feeling of: ${subject}\n\n${STYLE}`;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

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
    const user = (await userRes.json()) as { id: string };

    const { storyId } = (await req.json().catch(() => ({}))) as { storyId?: string };
    if (!storyId) return json({ error: "bad_request" }, 400);

    const storyRes = await fetch(
      `${supabaseUrl}/rest/v1/moments?select=id,title,hook,kind,source,image_url&id=eq.${encodeURIComponent(storyId)}`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    if (!storyRes.ok) return json({ error: "not_found" }, 404);

    const [story] = (await storyRes.json()) as {
      id: string;
      title: string;
      hook: string | null;
      kind: string;
      source: string;
      image_url: string | null;
    }[];
    if (!story) return json({ error: "not_found" }, 404);

    // Already has its own artwork.
    if (story.image_url && !story.image_url.includes("unsplash.com")) {
      return json({ imageUrl: story.image_url, cached: true }, 200);
    }

    const isShared = story.source === "catalogue";

    // Library tracks are keyed by title so one generation serves everyone.
    // Personal stories are keyed by id under the owner's folder.
    const path = isShared
      ? `covers/${slugify(story.title)}.png`
      : `covers/${user.id}/${story.id}.png`;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/vision/${path}`;

    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) {
      await setCover(supabaseUrl, serviceKey, storyId, publicUrl);
      return json({ imageUrl: publicUrl, cached: true }, 200);
    }

    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-1",
        prompt: buildPrompt(story.title, story.hook ?? story.title),
        n: 1,
        size: "1024x1024",
      }),
    });

    if (imageRes.status === 429) return json({ error: "rate_limited" }, 429);
    if (!imageRes.ok) {
      console.error("image error", imageRes.status, await imageRes.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await imageRes.json()) as { data?: { b64_json?: string; url?: string }[] };
    const first = payload.data?.[0];

    let bytes: Uint8Array;
    if (first?.b64_json) {
      bytes = Uint8Array.from(atob(first.b64_json), (c) => c.charCodeAt(0));
    } else if (first?.url) {
      const download = await fetch(first.url);
      if (!download.ok) return json({ error: "download_failed" }, 502);
      bytes = new Uint8Array(await download.arrayBuffer());
    } else {
      return json({ error: "no_image" }, 502);
    }

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/vision/${path}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "image/png",
        "x-upsert": "true",
        "Cache-Control": "31536000",
      },
      body: bytes,
    });

    if (!uploadRes.ok) {
      console.error("upload failed", await uploadRes.text().catch(() => ""));
      return json({ error: "storage_error" }, 500);
    }

    await setCover(supabaseUrl, serviceKey, storyId, publicUrl);
    console.log(`cover generated ${path} shared=${isShared}`);
    return json({ imageUrl: publicUrl, cached: false }, 200);
  } catch (error) {
    console.error("generate-cover failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

async function setCover(
  supabaseUrl: string,
  serviceKey: string,
  storyId: string,
  imageUrl: string,
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/moments?id=eq.${encodeURIComponent(storyId)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ image_url: imageUrl }),
  });
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
