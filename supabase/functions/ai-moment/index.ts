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
- Build it entirely from what they said they want, plus any reason, desired feeling or obstacle given. Reuse their exact vocabulary — if they wrote "my own apartment", the scene is about an apartment, not about money in general.
- Quiet and specific rather than grand. Ordinary sensory detail beats triumphant imagery. No stock phrases like "close your eyes and imagine".
- End with one small concrete action they could take today.

SETTING — you will be given a place. Obey it:
- The scene happens THERE. Open with something physical about that place: a sound, the temperature, the light, what's in your hands.
- Do not relocate to an office, a desk, a laptop, a screen or a meeting. Those are the default images and they are the reason every one of these reads the same. If the given setting is not a workplace, no workplace may appear.
- The place is where they are; the thing they want is what they're thinking about. Don't make the place a metaphor for the goal.

Hard constraint — this is the difference between a useful exercise and a false promise:
- Describe the user DOING the work and how that feels. Never describe the outcome arriving by itself, being given to them, or the universe/fate/energy delivering it.
- Never imply that visualizing causes external events. The honest mechanism is attention and follow-through: picturing it clearly helps you notice and take chances to act.
- No guarantees, no timelines, no "it's already yours".

Return ONLY JSON: {"title": "...", "body": "..."} where body uses \\n\\n between paragraphs. Title is 2-5 words. No markdown fence.`;

/**
 * Where each visualization takes place.
 *
 * This list exists because of a real complaint: "in more for you and trending
 * for you it shows you sit at your desk for everything, every track." That was
 * accurate — 135 of 590 stories mentioned a desk. Left to itself the model
 * writes an office every time, because a desk is what "working toward a goal"
 * looks like in its training data.
 *
 * The old defence was a line telling it to AVOID REPEATING recent titles. That
 * cannot work here. Forty stories are generated in parallel in about three
 * seconds, so every one of them reads the same "five most recent" list — none
 * of the others exist yet. Each request independently decides to be different
 * from the same five stories, and independently lands on a desk.
 *
 * So the setting is assigned rather than discouraged. It's derived from the
 * variant index, which the caller already varies per story, so forty parallel
 * requests get forty different places without any of them needing to know what
 * the others are doing. A constraint beats an instruction.
 */
const SCENES = [
  "a kitchen at night, everyone else asleep",
  "a bus or train, halfway through a journey",
  "a park bench, mid-afternoon, nothing scheduled",
  "the walk back from somewhere ordinary, in the cold",
  "a doorway, keys still in hand, having just got in",
  "a stairwell, sitting down for a second on the way up",
  "the shower, or just after it",
  "a bed, awake earlier than the alarm",
  "a queue somewhere dull — a bank, a pharmacy, a checkout",
  "a balcony or a step outside, in the first warm week of the year",
  "a car in a car park, engine off, not going in yet",
  "a kitchen table on a Sunday, the day unstructured",
  "a corridor outside a room you're about to walk into",
  "a window seat on a grey afternoon, rain on the glass",
  "the last ten minutes of a long walk with no destination",
  "a quiet cafe where nobody knows you",
];

/**
 * Pick a setting. Deterministic, so the same request always gets the same place.
 *
 * Both inputs matter. Variant alone would give every desire the same sequence
 * of places, so a user with four desires would see the kitchen scene four
 * times in one feed. Subject alone would give one desire one place forever.
 * Combined, the feed varies across both axes.
 */
function sceneFor(variant: number | undefined, subjectTitle: string): string {
  let hash = 0;
  for (const char of subjectTitle) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const index = Math.abs(hash) + (typeof variant === "number" ? Math.abs(variant) : 0);
  return SCENES[index % SCENES.length]!;
}

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
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash",
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
  if (lovableKey) return { url: GATEWAY_URL, apiKey: lovableKey, model: MODEL };

  return null;
}

/**
 * One retry, waiting as long as the provider asks.
 *
 * Gemini's free tier allows five requests a minute, and it doesn't just refuse
 * over that — it tells you exactly how long to wait ("Please retry in 15.4s").
 * Ignoring that and failing was throwing away a request the provider was
 * willing to serve fifteen seconds later.
 *
 * Deliberately one retry, capped. Retrying forever turns a rate limit into a
 * queue that grows faster than it drains, and an edge function has a wall-clock
 * budget of its own.
 */
async function askWithRetry(send: () => Promise<Response>, maxWaitMs = 20_000): Promise<Response> {
  const first = await send();
  if (first.status !== 429) return first;

  const body = await first
    .clone()
    .text()
    .catch(() => "");
  const suggested = /retry in ([\d.]+)s/i.exec(body)?.[1];
  const waitMs = suggested ? Math.ceil(Number(suggested) * 1000) + 500 : 5_000;
  if (waitMs > maxWaitMs) return first;

  console.warn(`rate limited; waiting ${waitMs}ms as instructed`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return send();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const provider = resolveProvider();
    const apiKey = provider?.apiKey;
    if (!apiKey) return json({ error: "not_configured" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);

    const { goalId, desireId, variant } = (await req.json().catch(() => ({}))) as {
      goalId?: string;
      desireId?: string;
      variant?: number;
    };

    // Two callers, two different tables.
    //
    // Home sends `desireId` — the thing the user typed into the box. That was
    // being ignored entirely: the function only read `goalId`, so an unmatched
    // request fell through to "the newest active goal" and wrote *that* story
    // against whatever desire the loop happened to be on. Every card came out
    // about the same old goal. Two stories in the database titled "Feeling
    // Super Rich" are filed under "Being deeply loved" and "My own apartment".
    // Nothing about it was custom.
    let subject: {
      title: string;
      why?: string | null;
      feeling?: string | null;
      obstacles?: string | null;
      progress?: number | null;
    } | null = null;

    if (desireId) {
      const desiresRes = await fetch(
        `${supabaseUrl}/rest/v1/desires?select=title,description&id=eq.${encodeURIComponent(desireId)}&limit=1`,
        { headers: { Authorization: authHeader, apikey: anonKey } },
      );
      const desires = desiresRes.ok ? await desiresRes.json() : [];
      const desire = Array.isArray(desires) ? desires[0] : null;
      if (desire) subject = { title: desire.title, why: desire.description };
    }

    if (!subject) {
      const filter = goalId ? `id=eq.${encodeURIComponent(goalId)}` : "status=eq.active";
      const goalsRes = await fetch(
        `${supabaseUrl}/rest/v1/goals?select=title,why,feeling,obstacles,category,progress&${filter}&order=created_at.desc&limit=1`,
        { headers: { Authorization: authHeader, apikey: anonKey } },
      );
      const goals = goalsRes.ok ? await goalsRes.json() : [];
      const goal = Array.isArray(goals) ? goals[0] : null;
      if (goal) subject = goal;
    }

    // If a specific desire was asked for and doesn't exist, don't quietly
    // substitute something else — that's the bug this replaces.
    if (!subject) {
      return json({ error: "no_subject", message: "Nothing to write about yet." }, 400);
    }

    const context = [
      `WHAT THEY WANT: ${subject.title}`,
      subject.why ? `WHY IT MATTERS: ${subject.why}` : "",
      subject.feeling ? `HOW THEY WANT IT TO FEEL: ${subject.feeling}` : "",
      subject.obstacles ? `WHAT'S IN THE WAY: ${subject.obstacles}` : "",
      subject.progress != null ? `MILESTONE PROGRESS: ${subject.progress}%` : "",
      `SETTING: ${sceneFor(variant, subject.title)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const upstream = await askWithRetry(() =>
      fetch(provider!.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider!.model,
          // Higher temperature: repetition across days is the #1 complaint about apps like this.
          temperature: 1.0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: context },
          ],
        }),
      }),
    );

    /**
     * Log why, not just that.
     *
     * Every chat call in the app returned 429 for a whole day and none of them
     * said anything about it, because this line returned before logging. A 429
     * from OpenAI is either "too many requests" or "no credit", and those need
     * completely different responses — one is our burst, the other is the
     * account. Not knowing which cost a day of guessing at symptoms.
     */
    if (upstream.status === 429) {
      const reason = await upstream.text().catch(() => "");
      console.error("rate limited by provider", reason.slice(0, 400));
      return json({ error: "rate_limited", detail: reason.slice(0, 200) }, 429);
    }
    if (upstream.status === 402) return json({ error: "credits_exhausted" }, 402);
    if (!upstream.ok) {
      console.error("gateway error", upstream.status, await upstream.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (payload.choices?.[0]?.message?.content ?? "").trim();
    const cleaned = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

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
