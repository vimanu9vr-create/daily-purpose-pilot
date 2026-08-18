// Writes affirmations from what the user actually told us they want.
//
// THE TONE PROBLEM, AND WHY THIS PROMPT CHANGED.
//
// The first version leaned hard on hedged openings - "I am learning to", "I am
// becoming", "I am allowed to". Every line was defensible and the whole set
// was limp. Read back, it sounded like a therapist being careful rather than
// something you would want in your ears at 6am.
//
// The distinction that actually matters is not hedged versus confident. It is
// IDENTITY versus PREDICTION.
//
//   "I am someone who handles money without flinching"  - identity. Bold,
//     present tense, and not a claim about the future. Fine, and far better.
//   "Money is flowing to me right now"                  - prediction dressed
//     as description. Not fine, and the thing that makes these apps hollow.
//
// So: write with total conviction about who the person is and what they do.
// Never predict what the world will hand them. That is how it can feel real
// without being a lie.
//
// Required secret: OPENAI_API_KEY (falls back to LOVABLE_API_KEY)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You write affirmations for a manifestation app. These are spoken aloud in a calm voice and listened to with eyes closed. They have to feel real - like something a person would actually say to themselves and believe.

WRITE WITH CONVICTION. Present tense. First person. Say it like it is already true of who they are.

Yes:
  "I am the kind of person who opens the banking app without flinching."
  "I do the work when nobody is watching, and it shows."
  "I walk into rooms I used to avoid."
  "My name comes up in conversations I am not in."

No - too soft, sounds like a disclaimer:
  "I am learning to maybe be more confident."
  "I am allowed to consider wanting more."

No - predicts the world instead of describing the person:
  "Money is flowing to me right now."
  "The universe is delivering my dream job."
  "Everything I want is on its way."

The line to hold: be absolutely certain about WHO THEY ARE and WHAT THEY DO. Never state what the world will give them, when, or that it is guaranteed. Identity, not prophecy.

Craft:
- One sentence, 8 to 16 words. Short enough to land in one breath.
- Concrete and physical. Name a room, an hour, an object, a gesture. "I close the laptop at six and it stays closed" beats "I have work-life balance".
- Use their exact vocabulary. If they wrote "20000cr", the affirmation says 20000cr.
- Vary the openings. Not every line starts with "I am".
- No exclamation marks, no emoji, no capitalised words, no rhyming.

STAY ON THE ONE THING THEY NAMED. If they gave you one goal, all six are about that goal. Do not drift to money if they asked about their app, or to work if they asked about love. Mixing topics is the fastest way to make the set feel random and generated.

Hard limits:
- No timelines, no guarantees, no "soon".
- Nothing about curing illness, medical recovery, or money arriving without work.
- Never imply thinking alone changes external events.

Return ONLY a JSON array of 6 strings. No object, no markdown fence, no commentary.`;

/**
 * Which AI provider to call.
 *
 * GEMINI FIRST, and that ordering is the point.
 *
 * Every text feature in this app — stories, affirmations, the daily action,
 * milestones — was sharing one OpenAI account. When its balance ran out, all
 * four stopped at once and each silently fell back to a local template. The
 * app didn't look broken; it looked bland, in four different places, which is
 * far harder to diagnose and exactly what happened.
 *
 * Google exposes Gemini through an OpenAI-compatible endpoint, so switching is
 * a URL and a model name — the request and response shapes are identical. It
 * has a free tier that comfortably covers this app's text volume, which means
 * the writing keeps working whether or not there is money in the account.
 *
 * OpenAI stays as the second choice for anyone who prefers it, and the Lovable
 * gateway as the third, so nothing that worked before stops working.
 */
function resolveProvider(): { url: string; apiKey: string; model: string } | null {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: geminiKey,
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.7-flash",
    };
  }

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

type Source = {
  title: string;
  why?: string | null;
  feeling?: string | null;
  obstacles?: string | null;
  category?: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const provider = resolveProvider();
    if (!provider) {
      return json({ error: "not_configured", message: "AI isn't switched on yet." }, 503);
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

    const { category, desireId } = (await req.json().catch(() => ({}))) as {
      category?: string | null;
      desireId?: string | null;
    };

    const headers = { Authorization: authHeader, apikey: anonKey };
    let sources: Source[] = [];

    /**
     * When a specific dream is named, read ONLY that dream.
     *
     * This is the fix for "it's just giving random affirmations". They weren't
     * random: the function was feeding every active desire plus the newest goal
     * into one prompt, so a set could contain one line about an app, one about
     * a job and one about 20000cr. Individually fine, together incoherent.
     */
    if (desireId) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/desires?select=title,description,category&id=eq.${encodeURIComponent(desireId)}`,
        { headers },
      );
      const rows = res.ok ? await res.json() : [];
      sources = (Array.isArray(rows) ? rows : []).map(
        (d: { title: string; description: string | null; category: string | null }) => ({
          title: d.title,
          why: d.description,
          category: d.category,
        }),
      );
    } else {
      const [desiresRes, goalsRes] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/desires?select=title,description,category&is_active=eq.true&order=created_at.desc&limit=2`,
          { headers },
        ),
        fetch(
          `${supabaseUrl}/rest/v1/goals?select=title,why,feeling,obstacles,category&status=eq.active&order=created_at.desc&limit=1`,
          { headers },
        ),
      ]);

      const desires = desiresRes.ok ? await desiresRes.json() : [];
      const goals = goalsRes.ok ? await goalsRes.json() : [];

      sources = [
        ...(Array.isArray(desires) ? desires : []).map(
          (d: { title: string; description: string | null; category: string | null }) => ({
            title: d.title,
            why: d.description,
            category: d.category,
          }),
        ),
        ...(Array.isArray(goals) ? goals : []),
      ];
    }

    if (sources.length === 0) {
      return json(
        {
          error: "no_goals",
          message: "Tell the app what you want first, and these get written from your own words.",
        },
        400,
      );
    }

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=desired_feeling,obstacles,tone&limit=1`,
      { headers },
    );
    const profiles = profileRes.ok ? await profileRes.json() : [];
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    const preamble = [
      profile?.desired_feeling ? `HOW THEY WANT TO FEEL: ${profile.desired_feeling}` : "",
      profile?.obstacles ? `WHAT USUALLY STOPS THEM: ${profile.obstacles}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const context = sources
      .map((source) =>
        [
          `WANTS: ${source.title}`,
          source.why ? `WHY: ${source.why}` : "",
          source.feeling ? `DESIRED FEELING: ${source.feeling}` : "",
          source.obstacles ? `OBSTACLE: ${source.obstacles}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n");

    const focus =
      sources.length === 1
        ? `Every affirmation must be about this one thing and nothing else: ${sources[0]!.title}`
        : "";

    const userContent = [
      preamble,
      context,
      focus,
      category ? `Slant these toward: ${category}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model,
        temperature: 1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (upstream.status === 429) {
      return json({ error: "rate_limited", message: "Try again shortly." }, 429);
    }
    if (upstream.status === 402) {
      return json({ error: "credits_exhausted", message: "Out of AI credits." }, 402);
    }
    if (!upstream.ok) {
      console.error("provider error", upstream.status, await upstream.text().catch(() => ""));
      return json({ error: "upstream_error", message: "Couldn't write those right now." }, 502);
    }

    const payload = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
    const affirmations = parseList(payload.choices?.[0]?.message?.content ?? "");

    if (affirmations.length === 0) {
      return json({ error: "empty", message: "Couldn't write those right now." }, 502);
    }

    const rows = affirmations.map((text) => ({
      user_id: user.id,
      text,
      category: category ?? sources[0]?.category ?? "growth",
      source: "ai",
    }));

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/affirmations`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });

    if (!insertRes.ok) {
      console.error("insert failed", await insertRes.text().catch(() => ""));
    }

    console.log(
      `affirmations written=${affirmations.length} sources=${sources.length} focused=${Boolean(desireId)}`,
    );
    return json({ affirmations }, 200);
  } catch (error) {
    console.error("ai-affirmations failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

function parseList(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 5 && entry.length <= 200)
      .slice(0, 8);
  } catch {
    return [];
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
