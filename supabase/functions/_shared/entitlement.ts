/**
 * Who is allowed to use what, decided on the server.
 *
 * ## Why this file exists
 *
 * The entitlement check lived in exactly one edge function — `narrate-story` —
 * and was written inline there. `ai-coach`, `ai-affirmations` and `ai-moment`
 * had no check at all: the free-tier limits in `plans.ts` were enforced by the
 * React code that draws the buttons and nowhere else. Anybody who opened
 * DevTools, or called the function URL directly with their own access token,
 * had unlimited coaching and unlimited generation on a free account. Those are
 * the three functions that bill Gemini per call.
 *
 * The one inline copy also carried two bugs that a shared, tested
 * implementation would not have had: both weekly plans were missing from the
 * tier switch, and the query filtered on `status` without looking at
 * `current_period_end`. See `narrate-story/tier.ts` for the full account.
 *
 * ## The rule
 *
 * Entitlement is `status IN (active, trialing)` AND the period has not
 * elapsed. Status alone is not enough: a row only moves to expired when the
 * store's webhook says so, and that webhook can be late, can fail, or can
 * never arrive. Through that window the row still reads active with a period
 * end in the past, and the person has stopped paying.
 *
 * A null `current_period_end` means lifetime, which never expires, so it has
 * to be allowed explicitly or one-time buyers lose what they bought.
 *
 * ## Failure direction
 *
 * Every error path returns the free tier. A database blip should cost somebody
 * a generation, not hand the paid features to everyone for as long as the blip
 * lasts. The caller is expected to still serve free-tier behaviour rather than
 * erroring outright — refusing everything on a transient read failure is its
 * own outage.
 */

export type Tier = "free" | "standard" | "voice";

/**
 * MUST MATCH `tierOf` in `src/features/billing/plans.ts`.
 *
 * Deno cannot import from `src/`, so this is a hand-maintained copy, and a
 * hand-maintained copy of a mapping is how weekly subscribers were recorded as
 * free for weeks. `entitlement.test.ts` reads the plan ids out of `plans.ts`
 * and fails the build if any of them land on "free" here.
 */
export function tierOf(plan: string | null | undefined): Tier {
  switch (plan) {
    case "standard_weekly":
    case "standard_monthly":
    case "standard_yearly":
    case "standard_lifetime":
      return "standard";
    // The bare three were sold before the Standard/Voice split, with narration
    // included. They keep what they bought.
    case "voice_weekly":
    case "voice_monthly":
    case "voice_yearly":
    case "monthly":
    case "yearly":
    case "lifetime":
      return "voice";
    default:
      return "free";
  }
}

/**
 * PostgREST credentials that work with either key format.
 *
 * This project has moved to opaque secret keys. An opaque key sent as
 * `Authorization: Bearer` is parsed as a JWT, fails `iat` validation and comes
 * back PGRST303 — one of the three faults that kept every push notification
 * silent for days. Here it would be quieter still: the read fails, the caller
 * falls back to free, and every paying subscriber is quietly demoted with
 * nothing in the logs but a status code.
 */
export function adminHeaders(): Record<string, string> {
  const secret = Deno.env.get("SUPABASE_SECRET_KEY");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const key = secret ?? legacy ?? "";
  const looksLikeJwt = key.split(".").length === 3 && key.startsWith("ey");
  return {
    apikey: key,
    ...(looksLikeJwt ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json",
  };
}

export type Entitlement = {
  tier: Tier;
  /** True for any paid tier whose period has not elapsed. */
  isPaid: boolean;
  /** Null for free users and for lifetime, which has no end. */
  periodEnd: string | null;
  /** Set when the row exists but the period has elapsed. Lets callers say so. */
  expired: boolean;
};

const FREE: Entitlement = { tier: "free", isPaid: false, periodEnd: null, expired: false };

/**
 * The caller's entitlement, read with the service key.
 *
 * Deliberately takes the user id rather than the request: every caller has
 * already verified the token against /auth/v1/user, and taking the id makes it
 * impossible to accidentally trust an id supplied in the request body.
 */
export async function entitlementFor(supabaseUrl: string, userId: string): Promise<Entitlement> {
  const now = new Date().toISOString();

  // Ask for any active row, elapsed or not, so we can tell "never paid" from
  // "paid and lapsed" — the two deserve different messages.
  const url =
    `${supabaseUrl}/rest/v1/subscriptions` +
    `?select=plan,status,current_period_end&user_id=eq.${userId}` +
    `&status=in.("active","trialing")&order=created_at.desc&limit=1`;

  let rows: { plan?: string; current_period_end?: string | null }[];
  try {
    const res = await fetch(url, { headers: adminHeaders() });
    if (!res.ok) {
      console.error(`entitlement read failed (${res.status}); treating as free`);
      return FREE;
    }
    rows = (await res.json()) as typeof rows;
  } catch (error) {
    console.error("entitlement read threw; treating as free", error);
    return FREE;
  }

  const row = rows[0];
  if (!row) return FREE;

  const periodEnd = row.current_period_end ?? null;
  const elapsed = Boolean(periodEnd && periodEnd <= now);
  if (elapsed) {
    console.log(`subscription elapsed for ${userId} (ended ${periodEnd})`);
    return { tier: "free", isPaid: false, periodEnd, expired: true };
  }

  const tier = tierOf(row.plan);
  return { tier, isPaid: tier !== "free", periodEnd, expired: false };
}

/**
 * Free-tier ceilings. MUST MATCH `FREE_LIMITS` in `src/features/billing/plans.ts`.
 *
 * These were enforced only in React, which means they were not enforced. The
 * cost of each is real money to us — Gemini per call — so the ceiling has to
 * live where the spend is authorised.
 */
export const FREE_LIMITS = {
  storiesPerRefresh: 3,
  coachMessagesPerDay: 5,
  aiAffirmationBatches: 1,
} as const;

/**
 * How many rows this user created today, UTC.
 *
 * UTC rather than their local day on purpose: the limit is a cost control, not
 * a feature, and a user who changes timezone should not be able to reset it by
 * flying east. The app's own day boundaries are separate and stay local.
 */
export async function countToday(
  supabaseUrl: string,
  table: string,
  userId: string,
  extraFilter = "",
): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=id&user_id=eq.${userId}` +
        `&created_at=gte.${since.toISOString()}${extraFilter}`,
      { headers: { ...adminHeaders(), Prefer: "count=exact", Range: "0-0" } },
    );
    if (!res.ok) {
      // Fail OPEN here, unlike the entitlement read. This is a spend ceiling,
      // not an access gate: a counting failure should not lock a paying or
      // free user out of the app, and the blast radius is a handful of extra
      // Gemini calls rather than a tier given away.
      console.error(`count of ${table} failed (${res.status}); allowing the request`);
      return 0;
    }
    const range = res.headers.get("content-range") ?? "";
    return Number(range.split("/")[1] ?? 0) || 0;
  } catch (error) {
    console.error(`count of ${table} threw; allowing the request`, error);
    return 0;
  }
}
