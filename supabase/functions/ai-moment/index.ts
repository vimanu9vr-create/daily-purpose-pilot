// Writes the daily "moment" — a short present-tense scene built from the
// user's own goal. The client falls back to an on-device composer if this
// isn't deployed, so the feature degrades rather than breaks.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You write a short daily visualization for a personal-growth app.

Form:
- Second person, present tense. 4 to 6 short paragraphs, roughly 150-220 words total.
- Build it entirely from the user's own goal, reason, desired feeling and stated obstacle. Reuse their vocabulary.
- Quiet and specific rather than grand. Ordinary sensory detail beats triumphant imagery. No stock phrases like "close your eyes and imagine".
- End with one small concrete action they could take today.

Hard constraint — this is the difference between a useful exercise and a false promise:
- Describe the user DOING the work and how that feels. Never describe the outcome arriving by itself, being given to them, or the universe/fate/energy delivering it.
- Never imply that visualizing causes external events. The honest mechanism is attention and follow-through: picturing it clearly helps you notice and take chances to act.
- No guarantees, no timelines, no "it's already yours".

Return ONLY JSON: {"title": "...", "body": "..."} where body uses \\n\\n between paragraphs. Title is 2-5 words. No markdown fence.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "not_configured" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);

    const { goalId, variant } = (await req.json().catch(() => ({}))) as {
      goalId?: string;
      variant?: number;
    };

    const filter = goalId ? `id=eq.${encodeURIComponent(goalId)}` : "status=eq.active";
    const goalsRes = await fetch(
      `${supabaseUrl}/rest/v1/goals?select=title,why,feeling,obstacles,category,progress&${filter}&order=created_at.desc&limit=1`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    const goals = goalsRes.ok ? await goalsRes.json() : [];
    const goal = Array.isArray(goals) ? goals[0] : null;

    if (!goal) return json({ error: "no_goal", message: "Add a goal first." }, 400);

    // Recent titles, so a "different one" is actually different.
    const recentRes = await fetch(
      `${supabaseUrl}/rest/v1/moments?select=title&order=created_at.desc&limit=5`,
      { headers: { Authorization: authHeader, apikey: anonKey } },
    );
    const recent = recentRes.ok ? await recentRes.json() : [];
    const recentTitles = Array.isArray(recent)
      ? recent.map((m: { title: string }) => m.title).join(", ")
      : "";

    const context = [
      `GOAL: ${goal.title}`,
      goal.why ? `WHY IT MATTERS: ${goal.why}` : "",
      goal.feeling ? `HOW THEY WANT IT TO FEEL: ${goal.feeling}` : "",
      goal.obstacles ? `WHAT'S IN THE WAY: ${goal.obstacles}` : "",
      `MILESTONE PROGRESS: ${goal.progress ?? 0}%`,
      recentTitles ? `AVOID REPEATING THESE RECENT ANGLES: ${recentTitles}` : "",
      variant !== undefined ? `The user asked for a different angle than the last one.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        // Higher temperature: repetition across days is the #1 complaint about apps like this.
        temperature: 1.0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: context },
        ],
      }),
    });

    if (upstream.status === 429) return json({ error: "rate_limited" }, 429);
    if (upstream.status === 402) return json({ error: "credits_exhausted" }, 402);
    if (!upstream.ok) {
      console.error("gateway error", upstream.status, await upstream.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (payload.choices?.[0]?.message?.content ?? "").trim();
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as { title?: string; body?: string };
      if (parsed.body?.trim()) {
        return json({ title: parsed.title ?? "Today's moment", body: parsed.body }, 200);
      }
    } catch {
      // Model returned prose instead of JSON — usable as-is.
      if (cleaned.length > 80) return json({ title: "Today's moment", body: cleaned }, 200);
    }

    return json({ error: "empty" }, 502);
  } catch (error) {
    console.error("ai-moment failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
