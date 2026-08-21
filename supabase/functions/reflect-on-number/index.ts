// Writes the question to sit under an angel number, for one person's dream.
//
// ## What this replaced, and why the split matters
//
// Each number used to carry two things: a fixed traditional meaning, and a
// fixed sentence with the person's dream slotted into a gap — "Which part of
// {goal} are you closest to giving up on?". Reported as "angel numbers doesn't
// seem to be true, it's just random words", which was fair. A sentence built
// to fit anybody fits nobody, and it reads as a template however carefully it
// is written, because it is one.
//
// The meaning stays fixed and is NOT generated. What 111 means is a fact about
// a tradition — one is the number of beginnings, repeated it is read as a
// doorway. Writing that per person would not make it more personal, it would
// make it invented, and inventing numerology at somebody is worse than
// reporting it honestly.
//
// What gets written is the question. That is the part that has to be about
// their life, and it is the part that cannot be pre-written.
//
// Required secret: GEMINI_API_KEY (falls back to OPENAI_API_KEY)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You write ONE question for a manifestation app.

Someone has noticed a repeating number. You are given what that number is traditionally read as, and the thing this person is actually working toward. Write the single question they should sit with.

Rules:
- One sentence. Under 25 words. It must end in a question mark.
- It has to be answerable only by them, about their own life. If the question would work equally well for a stranger, it has failed.
- Use their own nouns and numbers for what they want. Never paste their whole sentence in — they wrote it in first person about a wish, and this is a question addressed to them as "you". Rewrite it to fit.
- Take the number's traditional meaning as the ANGLE, not the subject. A number about completion asks what they are finished with; it does not explain what the number means. They have already read that.
- Ask about something specific and slightly uncomfortable — the thing they have been avoiding looking at. Gentle, not brutal, and never flattering.
- Plain language. No mysticism, no "the universe", no exclamation marks, no emoji.

Never:
- Never predict anything, promise anything, or imply the number causes events.
- Never give an instruction. It is a question, not a task.
- Never open with "What if" or "Have you considered".

Return ONLY the question. No quotes, no preamble, no explanation.`;

function resolveProvider(): { url: string; apiKey: string; model: string } | null {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      apiKey: geminiKey,
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

  return null;
}

/** Same ladder as everywhere else: another model is the fix for almost everything. */
const MODEL_LADDER = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

function anotherModelMightHelp(status: number): boolean {
  if (status < 400) return false;
  return status !== 400 && status !== 401 && status !== 403;
}

async function askWithRetry(
  send: (model: string) => Promise<Response>,
  model: string,
): Promise<Response> {
  const start = MODEL_LADDER.indexOf(model);
  const ladder = start === -1 ? [model, ...MODEL_LADDER] : MODEL_LADDER.slice(start);

  let last: Response | null = null;
  for (const candidate of ladder) {
    const response = await send(candidate);
    if (!anotherModelMightHelp(response.status)) return response;
    console.warn(`${candidate}: ${response.status}, dropping to the next model`);
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

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) return json({ error: "unauthorized" }, 401);

    const { number, meaning, theme, goal } = (await req.json().catch(() => ({}))) as {
      number?: string;
      meaning?: string;
      theme?: string;
      goal?: string;
    };
    if (!number || !meaning || !goal) return json({ error: "bad_request" }, 400);

    const context = [
      `THE NUMBER: ${number}`,
      `WHAT IT IS TRADITIONALLY READ AS: ${meaning}`,
      theme ? `THEME: ${theme}` : "",
      `WHAT THEY ARE WORKING TOWARD: ${goal}`,
    ]
      .filter(Boolean)
      .join("\n");

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
            // High, because the same number will come round again and asking
            // the same question twice is the thing this exists to stop.
            temperature: 1.0,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: context },
            ],
          }),
        }),
      provider.model,
    );

    if (!aiRes.ok) {
      console.error("reflect-on-number", aiRes.status, await aiRes.text().catch(() => ""));
      return json({ error: "upstream_error" }, 502);
    }

    const payload = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
    const question = (payload.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["'“]|["'”]$/g, "")
      .trim();

    // A question that isn't one is worse than the general fallback, and the
    // client has one of those. Refuse rather than pass it through.
    if (!question.includes("?") || question.length > 200) {
      console.warn(`unusable reflection for ${number}: ${question.slice(0, 80)}`);
      return json({ error: "unusable" }, 502);
    }

    console.log(`reflection written for ${number}`);
    return json({ question }, 200);
  } catch (error) {
    console.error("reflect-on-number failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
