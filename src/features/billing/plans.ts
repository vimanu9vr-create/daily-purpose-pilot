/**
 * Plans, tiers, and what each one unlocks.
 *
 * ## Why there are two paid plans instead of one
 *
 * Everything in this app except narration is effectively free to serve. Text
 * generation runs on Gemini's free tier; photographs come from Pexels' free
 * allowance; the database is a rounding error. Studio narration is the only
 * thing with a real per-use bill, and it is not a small one.
 *
 * The measured figure, taken from the narrations actually rendered on the
 * production account rather than estimated: the average story is 2,139
 * characters. On ElevenLabs' Creator plan ($22 for 121,000 credits, checked
 * August 2026) that is about 39c per listen at full quality, or 20c on Flash.
 *
 * A single $8.99 plan covering both means a subscriber who listens daily costs
 * $6-12 a month in audio and a subscriber who only reads costs nothing — and
 * the reader is quietly paying for the listener. Worse, the more people who use
 * the thing the app is best at, the faster it loses money, which is the wrong
 * shape for a business to have.
 *
 * So: Standard is the whole app with no narration, priced low because it costs
 * nothing to serve. Voice adds narration and is priced to cover its own bill.
 * Nobody subsidises anybody.
 *
 * ## Why Voice has no lifetime option
 *
 * Voice carries a cost that arrives every month forever. A single payment
 * cannot fund a recurring bill; selling one would mean either capping the
 * "lifetime" until it isn't one, or losing money on every heavy user for as
 * long as they keep the app. Lifetime therefore exists on Standard only, where
 * the marginal cost genuinely is near zero and the promise can be kept.
 *
 * ## Prices here are display-only
 *
 * On iOS and Android the real price comes from StoreKit or Play Billing,
 * localised to the user's storefront. Never treat a number in this file as
 * truth at the point of purchase, or someone in another currency sees a figure
 * that doesn't match what they're charged.
 */

export type PlanTier = "free" | "standard" | "voice";

export type PlanId =
  | "free"
  | "standard_monthly"
  | "standard_yearly"
  | "standard_lifetime"
  | "voice_monthly"
  | "voice_yearly"
  /**
   * Retired ids, still present on rows sold before the split.
   *
   * These were sold with narration included, so they map to the voice tier.
   * Honouring what somebody actually bought matters more than tidiness — a
   * paying user who opens the app and finds the voice gone has been robbed,
   * whatever the migration notes say.
   */
  | "monthly"
  | "yearly"
  | "lifetime";

export type Plan = {
  id: PlanId;
  tier: PlanTier;
  name: string;
  /** Store product identifier. Must match App Store Connect and Play Console. */
  productId: string | null;
  priceDisplay: string;
  cadence: string;
  blurb: string;
  highlight?: string;
};

export const STANDARD_PLANS: Plan[] = [
  {
    id: "standard_monthly",
    tier: "standard",
    name: "Monthly",
    productId: "com.manifestai.standard.monthly",
    priceDisplay: "$6.99",
    cadence: "per month",
    blurb: "Cancel any time.",
  },
  {
    id: "standard_yearly",
    tier: "standard",
    name: "Yearly",
    productId: "com.manifestai.standard.yearly",
    priceDisplay: "$49.99",
    cadence: "per year",
    blurb: "Works out at $4.17 a month.",
    highlight: "Save 40%",
  },
  {
    /**
     * $79.99 — level with Stella's top in-app purchase, deliberately.
     *
     * Close to pure margin: Standard costs almost nothing to serve, since the
     * text runs on Gemini's free tier and narration is what actually bills. So
     * the only question is what somebody will pay, not what it costs.
     *
     * Break-even against the yearly plan is about eighteen months, and anybody
     * still here in eighteen months was never going to churn anyway.
     */
    id: "standard_lifetime",
    tier: "standard",
    name: "Lifetime",
    productId: "com.manifestai.standard.lifetime",
    priceDisplay: "$79.99",
    cadence: "one payment",
    blurb: "Pay once. Yours permanently, including everything added later.",
  },
];

export const VOICE_PLANS: Plan[] = [
  {
    id: "voice_monthly",
    tier: "voice",
    name: "Monthly",
    productId: "com.manifestai.voice.monthly",
    priceDisplay: "$19.99",
    cadence: "per month",
    blurb: "Cancel any time.",
  },
  {
    id: "voice_yearly",
    tier: "voice",
    name: "Yearly",
    productId: "com.manifestai.voice.yearly",
    priceDisplay: "$149.99",
    cadence: "per year",
    blurb: "Works out at $12.50 a month.",
    highlight: "Save 37%",
  },
];

export const PLANS: Plan[] = [...STANDARD_PLANS, ...VOICE_PLANS];

/** What each tier gives you. Written plainly — no vague "premium experience". */
export const STANDARD_FEATURES = [
  "Unlimited stories, written for your own dreams",
  "Unlimited affirmations in your own words",
  "Unlimited coaching conversations",
  "The full library to read",
  "Vision boards, journal, gratitude and streaks",
  "Morning notifications",
] as const;

export const VOICE_FEATURES = [
  "Everything in Standard",
  "Studio narration in a real human voice",
  "Sleep sessions, meditations and frequencies, narrated",
  "Around fifty narrations a month — four in a day if you want them",
  "Sentence-by-sentence highlighting as it reads",
] as const;

/** Kept for the marketing copy and the store listing, which describe the top tier. */
export const PREMIUM_FEATURES = [...STANDARD_FEATURES, ...VOICE_FEATURES.slice(1)] as const;

/**
 * Free tier limits. Deliberately generous on everything that costs nothing —
 * Stella's reviews are full of people angry at a three-listens-a-day cap, and a
 * paywall that makes the app useless mostly produces uninstalls.
 *
 * Narration is not on this list, because free users get none. See
 * `SAMPLE_TRACK_TITLE` for what replaced the trial.
 */
export const FREE_LIMITS = {
  storiesPerRefresh: 3,
  coachMessagesPerDay: 5,
  aiAffirmationBatches: 1,
} as const;

/**
 * The one narrated track anybody can hear without paying.
 *
 * There is no free narration trial. A per-user trial is a per-user bill: at a
 * thousand installs a month it cost more than every paying subscriber's
 * listening combined, and it was spent mostly on people who never came back.
 *
 * But a paywall selling a voice nobody has heard is a paywall selling nothing.
 * The fix is that this is ONE track, shared by title, rendered once and served
 * to every user who ever opens it. The bill is about 20c in total, forever —
 * not 20c per person.
 *
 * It's a sleep track on purpose. It's the longest, calmest thing in the app and
 * the format the voice matters most in, so it's the fairest possible test of
 * whether somebody wants to pay for it.
 */
export const SAMPLE_TRACK_TITLE = "Tomorrow is not here yet";

/**
 * How much narration each tier may commission.
 *
 * `perDay` bounds a single day's spend. `perMonth` bounds the tail, so one
 * enthusiastic subscriber can't outrun the subscription paying for them.
 *
 * Only Voice gets any. Free and Standard are both zero — the one narrated
 * thing they can hear is `SAMPLE_TRACK_TITLE`, which is shared rather than
 * commissioned and so doesn't appear in any allowance.
 *
 * The voice figures, at ~20c a listen on Flash and a 15% store fee:
 *
 *   45/month costs $8.78.
 *   Voice monthly nets $16.99/month — $8.21 left at the ceiling.
 *   Voice yearly nets $10.62/month — $1.84 left at the ceiling.
 *
 * THE YEARLY PLAN SETS THIS NUMBER, not the monthly one. Sixty a month was
 * asked for and does not survive: at $149.99 a year the ceiling would cost
 * $11.70 against $10.62 of revenue, so the plan would lose a dollar a month
 * precisely when somebody loved it. That mistake has been made twice in this
 * file already — check the cheapest plan that carries the allowance, never the
 * dearest.
 *
 * The daily cap of 4 sits inside the monthly one so a single evening cannot
 * consume the month, while still allowing a long session.
 */
export const NARRATION_ALLOWANCE: Record<PlanTier, { perDay: number; perMonth: number }> = {
  free: { perDay: 0, perMonth: 0 },
  standard: { perDay: 0, perMonth: 0 },
  voice: { perDay: 4, perMonth: 45 },
};

/**
 * Which tier a stored plan id grants.
 *
 * The three bare ids are pre-split subscriptions. They were sold as
 * "everything", so they get everything.
 */
export function tierOf(planId: string | null | undefined): PlanTier {
  switch (planId) {
    case "standard_monthly":
    case "standard_yearly":
    case "standard_lifetime":
      return "standard";
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

export function includesVoice(planId: string | null | undefined): boolean {
  return tierOf(planId) === "voice";
}

export function planById(id: string): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/** Display name for a tier, for the profile screen and receipts. */
export function tierName(tier: PlanTier): string {
  if (tier === "voice") return "Voice";
  if (tier === "standard") return "Standard";
  return "Free";
}
