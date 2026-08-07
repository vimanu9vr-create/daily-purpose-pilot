// Writes affirmations from the user's own goals, in their own language.
//
// Falls back gracefully: if this isn't deployed the app uses its curated
// library, so the feature is never simply broken.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You write affirmations for a personal-growth app.

Rules:
- Present tense, first person, starting with "I" wherever it reads naturally.
- Ground each one in the user's actual goals, reasons and stated obstacles. Reuse their own vocabulary. Generic affirmations are a failure.
- Affirm identity, values and capability — who the person is being and what they are practising. NEVER assert that a future event will happen, that a wish will come true, or that thinking causes external outcomes.
- Bad: "Money flows to me effortlessly." "I will get the job." Good: "I ask for what I'm worth." "I do the work whether or not I feel ready."
- Short. One sentence each. No hedging, no therapy-speak, no exclamation marks.
- Write 8 of them, varied in angle: some about identity, some about the obstacle, some about the daily practice.

Return ONLY a JSON array of 8 strings. No prose, no markdown fence.`;

/**
 * Which AI provider to call.
 *
 * Set OPENAI_API_KEY and this calls OpenAI directly, so generations stop
 * drawing down Lovable credits — every story, affirmation and coach reply was
 * billing against them. With no OpenAI key it falls back to the Lovable
 * gateway exactly as before, so adding this breaks nothing.
 *
 * Both endpoints speak the same chat-completions shape; only the URL, key and
 * model differ. Deliberately inlined per function rather than shared, because
 * a relative import across function directories is one more thing that can
 * fail at deploy time.
 */
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
  if (lovableKey) {
    return { url: GATEWAY_URL, apiKey: lovableKey, model: MODEL };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const provider = resolveProvider();
    const apiKey = provider?.apiKey;
    if (!apiKey) {
      return json(
        {
          error: "not_configured",
          message: "Personalised affirmations aren't switched on yet — the library still works.",
        },
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

    const { category } = (await req.json().catch(() => ({}))) as { category?: string | null };

    // Read goals as the user — RLS keeps this scoped to them.
    const goalsRes = await fetch(
      `${supabaseUrl}/rest/v1/goals?select=title,why,feeling,obstacles,category&status=eq.active&order=created_at.desc&limit=3`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    const goals = goalsRes.ok ? await goalsRes.json() : [];

    if (!Array.isArray(goals) || goals.length === 0) {
      return json(
        { error: "no_goals", message: "Add a goal first so these can be written from your words." },
        400,
      );
    }

    const context = goals
      .map(
        (g: {
          title: string;
          why: string | null;
          feeling: string | null;
          obstacles: string | null;
        }) =>
          [
            `GOAL: ${g.title}`,
            g.why ? `WHY: ${g.why}` : "",
            g.feeling ? `DESIRED FEELING: ${g.feeling}` : "",
            g.obstacles ? `OBSTACLE: ${g.obstacles}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
      )
      .join("\n\n");

    const upstream = await fetch(provider!.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider!.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: category
              ? `${context}\n\nSlant these toward the theme: ${category}.`
              : context,
          },
        ],
      }),
    });

    if (upstream.status === 429) return json({ error: "rate_limited", message: "Try again shortly." }, 429);
    if (upstream.status === 402) {
      return json({ error: "credits_exhausted", message: "The workspace is out of AI credits." }, 402);
    }
    if (!upstream.ok) {
      console.error("gateway error", upstream.status, await upstream.text().catch(() => ""));
      return json({ error: "upstream_error", message: "Couldn't write those right now." }, 502);
    }

    const payload = (await upstream.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "[]";
    const affirmations = parseList(raw);

    if (affirmations.length === 0) {
      return json({ error: "empty", message: "Couldn't write those right now." }, 502);
    }

    // Persist with the service role so the batch insert is one round trip.
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/affirmations`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(
        affirmations.map((text) => ({
          user_id: user.id,
          text,
          category: category ?? "growth",
          source: "ai",
          is_favorite: false,
        })),
      ),
    });

    if (!insertRes.ok) {
      console.error("insert failed", await insertRes.text().catch(() => ""));
      return json({ error: "save_failed", message: "Wrote them but couldn't save them." }, 500);
    }

    return json({ affirmations }, 200);
  } catch (error) {
    console.error("ai-affirmations failed", error);
    return json({ error: "internal_error", message: "Something went wrong." }, 500);
  }
});

function parseList(raw: string): string[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8);
    }
  } catch {
    // Model ignored the format — recover line by line.
  }
  return cleaned
    .split("\n")
    .map((line) => line.replace(/^\s*[-*\d.")\]]+\s*/, "").replace(/^["']|["'],?$/g, "").trim())
    .filter((line) => line.length > 0 && line.length < 200)
    .slice(0, 8);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
