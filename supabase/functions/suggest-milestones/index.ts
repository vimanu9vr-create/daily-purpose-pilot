// Replaces a desire's template milestones with ones written for that desire.
//
// The client has already inserted five sensible template steps and shown them,
// so this only ever improves what's on screen. Failure is invisible.
//
// Required secret: OPENAI_API_KEY (falls back to LOVABLE_API_KEY)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = `You break a personal goal into 5 milestones for a personal-growth app.

The arc, in order:
1. Understand where they are now, honestly.
2. Define what finished actually looks like.
3. The smallest real step.
4. Make it repeatable rather than heroic.
5. The step that only makes sense once they've started.

Rules:
- Each milestone is one short line, under 12 words, in second person or as a plain noun phrase.
- Concrete and checkable. "Feel more confident" is wrong. "Speak up once in a meeting" is right.
- Weeks apart, not days. These are stages, not daily tasks.
- Use their own vocabulary where it fits.
- Plain language. No hype, no exclamation marks, no emoji.

Hard constraints:
- Never imply the goal is guaranteed.
- Never suggest anything medical, legal or financial that needs a professional, and never anything that requires significant money.

Return ONLY JSON: {"milestones":["...","...","...","...","..."]}. Exactly 5. No markdown fence.`;

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
      // 2.5-flash 404s for accounts that never used it. See MODEL_LADDER.
      model: Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash",
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

/**
 * Ask, and keep asking sensibly when the provider says no.
 *
 * Three failure modes, three different right answers.
 *
 * PER MINUTE — 429 with "Please retry in 15.4s". A queue, not a wall. The
 * provider is telling you exactly when it will serve you. Wait that long and
 * ask again; giving up throws away a request that was available.
 *
 * PER DAY — 429 with "You exceeded your current quota", no retry time, because
 * there isn't one: the allowance is gone until midnight Pacific. Waiting is
 * useless, so move to a different model.
 *
 * MODEL GONE — 404. Not ours to call: retired, renamed, or closed to new
 * accounts. Move to a different model immediately.
 *
 * Requests-per-day is metered PER MODEL, so each rung is another day's
 * allowance. Deliberately one wait per model, capped — retrying forever turns
 * a rate limit into a queue that grows faster than it drains.
 */
/**
 * Fallbacks, in order, each with its own daily allowance.
 *
 * ## Why none of these are 2.5
 *
 * gemini-2.5-flash returns 404 on this account: "This model is no longer
 * available to new users. Please update your code to use models/gemini-3.6-flash."
 * Not deprecated-and-still-serving — closed to accounts that hadn't already
 * used it. So every text call in the app was 404ing, which is why the writing
 * stayed on templates even after the quota reset. I'd fixed the quota and the
 * real error underneath it was a different number entirely.
 *
 * gemini-3.6-flash is the model Google's own error message names. The rest are
 * current stable lites, each metered separately.
 */
const MODEL_LADDER = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

async function askWithRetry(
  send: (model: string) => Promise<Response>,
  model: string,
  maxWaitMs = 20_000,
): Promise<Response> {
  const start = MODEL_LADDER.indexOf(model);
  const ladder = start === -1 ? [model, ...MODEL_LADDER] : MODEL_LADDER.slice(start);

  let last: Response | null = null;

  for (const candidate of ladder) {
    let response = await send(candidate);
    if (response.status !== 429 && response.status !== 404) return response;

    const body = await response
      .clone()
      .text()
      .catch(() => "");

    /**
     * 404 means this model isn't ours to call — retired, renamed, or closed to
     * new accounts. Try the next one rather than failing.
     *
     * The first version of this ladder only caught 429, and the actual error
     * was 404. A fallback chain that handles one failure mode and passes the
     * other straight through is barely a fallback chain at all.
     */
    if (response.status === 404) {
      console.warn(`${candidate}: unavailable (404), dropping to the next model`);
      last = response;
      continue;
    }

    const suggested = /retry in ([\d.]+)s/i.exec(body)?.[1];

    if (suggested) {
      // Per-minute. Waiting is the whole fix — the same model will serve it.
      const waitMs = Math.ceil(Number(suggested) * 1000) + 500;
      if (waitMs <= maxWaitMs) {
        console.warn(`${candidate}: per-minute limit, waiting ${waitMs}ms as instructed`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        response = await send(candidate);
        if (response.status !== 429) return response;
      }
    } else {
      // Per-day. Waiting is pointless; the allowance is gone until midnight.
      console.warn(`${candidate}: daily quota exhausted, dropping to the next model`);
    }

    last = response;
  }

  return last!;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const provider = resolveProvider();
    if (!provider) return json({ error: "not_configured" }, 503);

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

    const { desireId, title, category, why } = (await req.json().catch(() => ({}))) as {
      desireId?: string;
      title?: string;
      category?: string | null;
      why?: string | null;
    };
    if (!desireId || !title) return json({ error: "bad_request" }, 400);

    const parts = [`goal: ${title}`];
    if (category) parts.push(`area: ${category}`);
    if (why) parts.push(`why it matters: ${why}`);

    const aiRes = await askWithRetry(
      (model) =>
        fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: parts.join("\n") },
            ],
            temperature: 0.7,
          }),
        }),
      provider.model,
    );

    if (aiRes.status === 429) {
      const reason = await aiRes.text().catch(() => "");
      console.error("milestones refused: 429", reason.slice(0, 400));
      return json({ error: "rate_limited" }, 429);
    }
    if (!aiRes.ok) {
      console.error("ai error", aiRes.status, await aiRes.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
    const milestones = parseMilestones(payload.choices?.[0]?.message?.content ?? "");
    if (milestones.length !== 5) return json({ error: "unparseable" }, 502);

    // Only replace steps nobody has ticked yet. Overwriting a completed step
    // would erase evidence of work someone actually did, which is the single
    // worst thing this function could do.
    const query = new URLSearchParams({
      user_id: `eq.${user.id}`,
      desire_id: `eq.${desireId}`,
      completed_at: "is.null",
      select: "id,position",
    });

    const existingRes = await fetch(`${supabaseUrl}/rest/v1/milestones?${query}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!existingRes.ok) return json({ error: "read_failed" }, 502);

    const existing = (await existingRes.json()) as { id: string; position: number }[];
    let updated = 0;

    for (const row of existing) {
      const replacement = milestones[row.position];
      if (!replacement) continue;

      const res = await fetch(
        `${supabaseUrl}/rest/v1/milestones?id=eq.${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ title: replacement }),
        },
      );
      if (res.ok) updated += 1;
    }

    console.log(`milestones upgraded=${updated} desire=${desireId}`);
    return json({ updated }, 200);
  } catch (error) {
    console.error("suggest-milestones failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

function parseMilestones(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { milestones?: unknown };
    if (!Array.isArray(parsed.milestones)) return [];
    return parsed.milestones
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.length <= 120);
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
