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
// ONE OF THE SIX IS THE ANCHOR.
//
// Asked for as "one powerful affirmation for certain desires". Six good lines
// is a list, and a list is something you scroll past; one line that is clearly
// THE line is something you can carry around all day. The other five stay as
// variation, so the set does not go stale when it is read every morning.
//
// The anchor is written to a different brief: shortest, most physical, no
// hedging, and it has to survive being said out loud in the car.
//
// Required secret: GEMINI_API_KEY (falls back to OPENAI_API_KEY, then LOVABLE_API_KEY)

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

ONE OF THEM IS THE ANCHOR, and it is a different job from the other five.

The five are variation — they stop the set going stale when someone reads it every morning for a month. The anchor is the one line they carry around all day. It has to survive being repeated hundreds of times without wearing out, so:
- Shortest of the set. Under 12 words if you can.
- The most concrete and the most physical. It should put them somewhere, doing something.
- No hedging, no qualifiers, no "learning to", no "beginning to".
- The one you would say out loud in the car. If it would be awkward said aloud, it is not the anchor.

Return ONLY JSON: {"anchor":"<the one line>","affirmations":["...","...","...","...","..."]}. Exactly one anchor and exactly five others, all different. No markdown fence, no commentary.`;

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

type Source = {
  title: string;
  why?: string | null;
  feeling?: string | null;
  obstacles?: string | null;
  category?: string | null;
};

/**
 * Ask, and keep asking sensibly when the provider says no.
 *
 * ## Why this asks "could another model help?" rather than listing error codes
 *
 * I have now written this function three times, and each time I handled
 * exactly the failure I had just seen in the logs and called it fixed. First
 * 429 only — and the real error turned out to be 404. Then 429 and 404 — and
 * the real error turned out to be 503. Each version looked complete, and each
 * left the app on templates for a reason I hadn't thought of yet.
 *
 * So the rule is inverted. Instead of enumerating what to survive, it asks
 * whether a different model could possibly help — and the answer is yes for
 * everything except a request that is wrong in itself. That way the next
 * unfamiliar status code is already handled.
 *
 * The failures seen so far, and why each lands where it does:
 *
 * PER MINUTE — 429 with "Please retry in 15.4s". A queue, not a wall. The
 * provider is telling you exactly when it will serve you, so wait and re-ask
 * the SAME model; giving up throws away a request that was available.
 *
 * PER DAY — 429 with "You exceeded your current quota" and no retry time,
 * because there isn't one: gone until midnight Pacific. Waiting is useless, so
 * move on. Requests-per-day is metered per model, so the next rung is a fresh
 * allowance.
 *
 * MODEL GONE — 404. Retired, renamed, or closed to new accounts. Move on.
 *
 * OVERLOADED — 503, "experiencing high demand". Transient and specific to that
 * model, so another one will usually answer immediately. Move on.
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

/**
 * Is this worth trying a different model for?
 *
 * Yes for everything except a request that is wrong in itself. 400, 401 and
 * 403 mean a malformed prompt or a bad key, which fail identically on every
 * model in the ladder — walking the whole list would be four identical
 * failures and four times the wait.
 */
function anotherModelMightHelp(status: number): boolean {
  if (status < 400) return false;
  return status !== 400 && status !== 401 && status !== 403;
}

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
    if (!anotherModelMightHelp(response.status)) return response;

    const body = await response
      .clone()
      .text()
      .catch(() => "");

    // Anything that isn't a per-minute limit: another model is the fix, and
    // waiting on this one is not.
    if (response.status !== 429) {
      console.warn(`${candidate}: ${response.status}, dropping to the next model`);
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

    const { category, desireId, stages } = (await req.json().catch(() => ({}))) as {
      category?: string | null;
      desireId?: string | null;
      /**
       * Theme names for a 7- or 21-day programme, in order.
       *
       * Reported as: the 7-day and 21-day programmes show the same
       * affirmations for every dream — the Defender, the $10k, the app.
       *
       * They did. The days came from a hardcoded list of seven stages, and
       * THREE OF THE SEVEN never referenced the dream at all, so those days
       * were byte-identical whatever somebody had typed. The other four
       * substituted the title into a slot shaped for a noun, which produced
       * "I want I am earning $10k weekly, and I say so without apologising"
       * — the same grammar-shape bug the stories had.
       *
       * The stage ARC is good and stays: naming, deserving, identity, work,
       * doubt, being seen, ordinary. It is the LINES that have to be written
       * for the dream. One call for the whole programme rather than one per
       * day, because seven round trips is a spinner nobody waits through.
       */
      stages?: string[];
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

    /**
     * Programme mode. Same voice and same rules, a different shape of answer.
     *
     * Deliberately reuses this function rather than adding another one: the
     * conviction rules, the identity-not-prophecy line, the banned openings and
     * the honesty limits all live in SYSTEM_PROMPT, and a second writer would
     * mean two places to keep those correct. The stage themes are the only new
     * information.
     */
    const programmeAsk =
      stages && stages.length > 0
        ? [
            `WRITE A ${stages.length}-DAY PROGRAMME, not a single set.`,
            `Each day has its own theme, in this order: ${stages.map((s, i) => `${i + 1}. ${s}`).join("; ")}.`,
            `For each day write ONE intention and FOUR affirmations, both belonging to that day's theme AND to their one subject. Every day must read differently from every other day — the themes are what makes them differ, so anything that would fit any day is wrong.`,
            `The intention is one sentence of second person addressed to them — what today is for. Never paste their subject in as a phrase; write around its nouns and numbers, because what they typed may be a whole sentence and dropping it into a slot produces gibberish.`,
            `At least two lines a day must contain something concrete from their subject — its noun, its number, the room it changes. A day with no trace of what they typed is the failure this replaces.`,
            `Return ONLY JSON: {"days":[{"intention":"...","lines":["...","...","...","..."]}]} with exactly ${stages.length} entries in the order given. No markdown fence.`,
          ].join("\n")
        : "";

    const userContent = [
      preamble,
      context,
      focus,
      category ? `Slant these toward: ${category}.` : "",
      programmeAsk,
    ]
      .filter(Boolean)
      .join("\n\n");

    const upstream = await askWithRetry(
      (model) =>
        fetch(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: 1,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
          }),
        }),
      provider.model,
    );

    // Log the reason, not just the status. A bare "429" is what turned a spent
    // daily quota into a day of guessing why the writing had gone bland.
    if (upstream.status === 429) {
      const reason = await upstream.text().catch(() => "");
      console.error("affirmations refused: 429", reason.slice(0, 400));
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
    const raw = payload.choices?.[0]?.message?.content ?? "";

    /**
     * Programme mode returns and stops here.
     *
     * Nothing is written to `affirmations`: these are a programme's days, not
     * six lines to carry around, and mixing them into the saved set would put
     * twenty-eight rows into a deck somebody swipes through one at a time.
     * The caller writes them to `programme_days`.
     */
    if (stages && stages.length > 0) {
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();

      let days: { intention: string; lines: string[] }[] = [];
      try {
        const parsed = JSON.parse(cleaned) as { days?: { intention?: unknown; lines?: unknown }[] };
        days = (parsed.days ?? [])
          .map((day) => ({
            intention: typeof day.intention === "string" ? day.intention.trim() : "",
            lines: Array.isArray(day.lines)
              ? day.lines.filter((l): l is string => typeof l === "string" && l.trim().length > 0)
              : [],
          }))
          .filter((day) => day.lines.length > 0);
      } catch {
        console.error("programme: unparseable", cleaned.slice(0, 300));
      }

      // Short is worse than absent: a programme missing days would show blanks
      // partway through a commitment somebody made. Fail so the caller can say so.
      if (days.length < stages.length) {
        console.error(`programme: got ${days.length} days, wanted ${stages.length}`);
        return json({ error: "empty", message: "Couldn't write that programme." }, 502);
      }

      return json({ days: days.slice(0, stages.length) }, 200);
    }

    const { anchor, rest } = parseSet(raw);

    if (!anchor && rest.length === 0) {
      return json({ error: "empty", message: "Couldn't write those right now." }, 502);
    }

    /**
     * Clear the old anchor before writing the new one.
     *
     * There is a unique index allowing one anchor per desire, so without this
     * the insert below fails outright the second time somebody regenerates —
     * and the failure would look like "affirmations stopped working" rather
     * than like a constraint doing its job.
     */
    if (desireId && anchor) {
      await fetch(
        `${supabaseUrl}/rest/v1/affirmations?user_id=eq.${user.id}` +
          `&desire_id=eq.${encodeURIComponent(desireId)}&is_anchor=is.true`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ is_anchor: false }),
        },
      );
    }

    const shared = {
      user_id: user.id,
      // Written from one dream, so recorded against it. This column did not
      // exist until now: the function was already being told which desire to
      // write about and the answer was thrown away, which is why nothing in
      // the app could show "the affirmations for this dream".
      desire_id: desireId ?? null,
      category: category ?? sources[0]?.category ?? "growth",
      source: "ai",
    };

    const rows = [
      ...(anchor ? [{ ...shared, text: anchor, is_anchor: Boolean(desireId) }] : []),
      ...rest.map((text) => ({ ...shared, text, is_anchor: false })),
    ];

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
      return json({ error: "storage_error", message: "Couldn't save those." }, 500);
    }

    console.log(
      `affirmations written=${rows.length} anchor=${Boolean(anchor)} desire=${desireId ?? "none"}`,
    );
    return json({ anchor, affirmations: rest }, 200);
  } catch (error) {
    console.error("ai-affirmations failed", error);
    return json({ error: "internal_error", message: String(error) }, 500);
  }
});

/**
 * The anchor and the rest.
 *
 * Accepts the old bare-array shape as well, because a model that ignores the
 * JSON instruction and returns six strings has still done the useful work —
 * losing all six over a formatting quibble would be the wrong trade. In that
 * case the first line becomes the anchor, which is a guess but a harmless one.
 */
function parseSet(raw: string): { anchor: string | null; rest: string[] } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  const usable = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 5 && value.trim().length <= 200;

  try {
    const parsed = JSON.parse(cleaned) as unknown;

    if (Array.isArray(parsed)) {
      const all = parsed.filter(usable).map((entry) => entry.trim());
      return { anchor: all[0] ?? null, rest: all.slice(1, 8) };
    }

    const shaped = parsed as { anchor?: unknown; affirmations?: unknown };
    const anchor = usable(shaped.anchor) ? shaped.anchor.trim() : null;
    const rest = Array.isArray(shaped.affirmations)
      ? shaped.affirmations
          .filter(usable)
          .map((entry) => entry.trim())
          .slice(0, 8)
      : [];
    return { anchor, rest };
  } catch {
    return { anchor: null, rest: [] };
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
