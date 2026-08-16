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
  if (lovableKey) return { url: GATEWAY_URL, apiKey: lovableKey, model: FALLBACK_MODEL };
  return null;
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

    const aiRes = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: parts.join("\n") },
        ],
        temperature: 0.7,
      }),
    });

    if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
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
