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
- Ground every reply in WHAT THEY SAID THEY WANT TO MANIFEST — their own typed words, given to you below. Quote their phrasing back to them. Their goals, habits and reflections are also provided; use them, but the thing they typed is the subject.
- Never answer in generalities that would fit any user. If your reply would make sense to someone with completely different dreams, you have not used what you were given.
- End with ONE concrete next action the user could take in the next 24 hours. Small and specific beats ambitious and vague.
- Be warm and direct. Two or three short paragraphs. No bullet lists unless the user asks.

Hard boundaries:
- Never promise or imply that thinking, believing or visualizing causes external outcomes. Visualization and affirmation help with motivation, attention and follow-through — that is the honest claim, and it is enough.
- Never guarantee a result, timeline, or probability of success.
- You are not a therapist or a doctor. If the user describes symptoms of depression, self-harm, an eating disorder, or a mental health crisis, do not coach through it. Acknowledge it plainly, say it deserves real support, and encourage them to talk to a professional or someone they trust.
- No financial, legal or medical advice.
- If the user asks about something outside goals, habits and reflection, answer briefly and steer back.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

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

    /**
     * DESIRES FIRST, and adding them at all is the point of this change.
     *
     * This function read `goals` and nothing else, so the coach had never seen
     * a single word the user typed into "what do you want to manifest?" — the
     * one box the whole app is built around. It was coaching them from a
     * different, largely empty table while claiming to know them.
     *
     * They are listed before goals for the same reason the subject goes first
     * in the story prompt: whatever appears first, and is named as the point,
     * is what gets treated as the point.
     */
    const [desiresRes, goalsRes, habitsRes, journalRes] = await Promise.all([
      rest("desires?select=title,description&order=created_at.desc&limit=6"),
      rest(
        "goals?select=title,why,feeling,obstacles,category,target_date,progress,status&status=eq.active&order=created_at.desc&limit=3",
      ),
      rest("habits?select=name,target_per_week&active=is.true&limit=10"),
      rest("journals?select=entry_date,mood,content&order=entry_date.desc&limit=5"),
    ]);

    const desires = desiresRes.ok ? await desiresRes.json() : [];
    const goals = goalsRes.ok ? await goalsRes.json() : [];
    const habits = habitsRes.ok ? await habitsRes.json() : [];
    const journals = journalRes.ok ? await journalRes.json() : [];

    const contextBlock = buildContext(desires, goals, habits, journals);

    const upstream = await fetch(provider!.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider!.model,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: contextBlock },
          ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (upstream.status === 429) {
      return json(
        { error: "rate_limited", message: "Too many requests — try again shortly." },
        429,
      );
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
  desires: { title: string; description: string | null }[],
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

  /**
   * Their own sentences, quoted verbatim and labelled as such.
   *
   * Quoted because the wording is evidence. Somebody who wrote "my aim is to
   * earn 20000cr" and somebody who wrote "financial freedom" want different
   * things and should not get the same reply, and the difference lives
   * entirely in how they said it.
   */
  if (desires.length > 0) {
    parts.push(
      "WHAT THEY SAID THEY WANT TO MANIFEST — their own words, most recent first. " +
        "This is the heart of it. Use their phrasing back to them:\n" +
        desires
          .map((d) => [`- "${d.title}"`, d.description ? `  they added: ${d.description}` : ""])
          .flat()
          .filter(Boolean)
          .join("\n"),
    );
  }

  if (goals.length === 0) {
    // Only worth saying when there is nothing else either. Telling somebody
    // with six dreams written down that they should "name one concrete goal"
    // reads as not having looked.
    if (desires.length === 0) {
      parts.push("Nothing written down yet. Help them name one thing they want, in their words.");
    }
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
