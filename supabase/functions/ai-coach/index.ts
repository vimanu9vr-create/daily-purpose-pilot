// ManifestAI coaching endpoint.
//
// Streams a coaching reply over SSE. The caller's JWT is verified against
// Supabase Auth, and every piece of context is re-read server-side under that
// user's identity — the client never gets to say whose goals to load.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You are the coach inside ManifestAI, an app that combines goal clarity, habit formation and reflection.

How you work:
- Ground every reply in the user's actual goals, habits and recent reflections, which are provided to you. Reference them specifically rather than speaking in generalities.
- End with ONE concrete next action the user could take in the next 24 hours. Small and specific beats ambitious and vague.
- Be warm and direct. Two or three short paragraphs. No bullet lists unless the user asks.

Hard boundaries:
- Never promise or imply that thinking, believing or visualizing causes external outcomes. Visualization and affirmation help with motivation, attention and follow-through — that is the honest claim, and it is enough.
- Never guarantee a result, timeline, or probability of success.
- You are not a therapist or a doctor. If the user describes symptoms of depression, self-harm, an eating disorder, or a mental health crisis, do not coach through it. Acknowledge it plainly, say it deserves real support, and encourage them to talk to a professional or someone they trust.
- No financial, legal or medical advice.
- If the user asks about something outside goals, habits and reflection, answer briefly and steer back.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json(
        { error: "not_configured", message: "The coach isn't connected to a model provider yet." },
        503,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller from their JWT.
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);
    const user = (await userRes.json()) as { id: string };

    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "bad_request", message: "No messages provided." }, 400);
    }

    // Read context as the user — RLS keeps this scoped to them.
    const asUser = { Authorization: authHeader, apikey: anonKey };
    const rest = (path: string) => fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: asUser });

    const [goalsRes, habitsRes, journalRes] = await Promise.all([
      rest("goals?select=title,why,feeling,obstacles,category,target_date,progress,status&status=eq.active&order=created_at.desc&limit=3"),
      rest("habits?select=name,target_per_week&active=is.true&limit=10"),
      rest("journals?select=entry_date,mood,content&order=entry_date.desc&limit=5"),
    ]);

    const goals = goalsRes.ok ? await goalsRes.json() : [];
    const habits = habitsRes.ok ? await habitsRes.json() : [];
    const journals = journalRes.ok ? await journalRes.json() : [];

    const contextBlock = buildContext(goals, habits, journals);

    const upstream = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: contextBlock },
          ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (upstream.status === 429) {
      return json({ error: "rate_limited", message: "Too many requests — try again shortly." }, 429);
    }
    if (upstream.status === 402) {
      return json(
        { error: "credits_exhausted", message: "The workspace is out of AI credits." },
        402,
      );
    }
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.error("gateway error", upstream.status, detail);
      return json({ error: "upstream_error", message: "The coach is unavailable right now." }, 502);
    }

    console.log(`coach: user=${user.id} goals=${goals.length} habits=${habits.length}`);

    return new Response(upstream.body, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("coach failed", error);
    return json({ error: "internal_error", message: "Something went wrong." }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function buildContext(
  goals: {
    title: string;
    why: string | null;
    feeling: string | null;
    obstacles: string | null;
    target_date: string | null;
    progress: number;
  }[],
  habits: { name: string; target_per_week: number }[],
  journals: { entry_date: string; mood: number | null; content: string }[],
): string {
  const parts: string[] = ["Here is the user's current context. Refer to it specifically."];

  if (goals.length === 0) {
    parts.push("GOALS: none set yet. Help them name one concrete goal before anything else.");
  } else {
    parts.push(
      "GOALS:\n" +
        goals
          .map((g) =>
            [
              `- "${g.title}" (${g.progress}% of milestones done${g.target_date ? `, target ${g.target_date}` : ""})`,
              g.why ? `  why: ${g.why}` : "",
              g.feeling ? `  desired feeling: ${g.feeling}` : "",
              g.obstacles ? `  stated obstacle: ${g.obstacles}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n"),
    );
  }

  parts.push(
    habits.length === 0
      ? "HABITS: none tracked yet."
      : "HABITS: " + habits.map((h) => `${h.name} (${h.target_per_week}×/week)`).join(", "),
  );

  if (journals.length > 0) {
    parts.push(
      "RECENT JOURNAL (newest first):\n" +
        journals
          .map(
            (j) =>
              `- ${j.entry_date}${j.mood ? ` (mood ${j.mood}/5)` : ""}: ${j.content.slice(0, 280)}`,
          )
          .join("\n"),
    );
  }

  return parts.join("\n\n");
}
