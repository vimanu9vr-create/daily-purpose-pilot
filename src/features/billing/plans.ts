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
    priceDisplay: "$4.99",
    cadence: "per month",
    blurb: "Cancel any time.",
  },
  {
    id: "standard_yearly",
    tier: "standard",
    name: "Yearly",
    productId: "com.manifestai.standard.yearly",
    priceDisplay: "$29.99",
    cadence: "per year",
    blurb: "Works out at $2.50 a month.",
    highlight: "Save 50%",
  },
  {
    id: "standard_lifetime",
    tier: "standard",
    name: "Lifetime",
    productId: "com.manifestai.standard.lifetime",
    priceDisplay: "$99.99",
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
    priceDisplay: "$14.99",
    cadence: "per month",
    blurb: "Cancel any time.",
  },
  {
    id: "voice_yearly",
    tier: "voice",
    name: "Yearly",
    productId: "com.manifestai.voice.yearly",
    priceDisplay: "$99.99",
    cadence: "per year",
    blurb: "Works out at $8.33 a month.",
    highlight: "Save 44%",
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
  "Sentence-by-sentence highlighting as it reads",
] as const;

/** Kept for the marketing copy and the store listing, which describe the top tier. */
export const PREMIUM_FEATURES = [...STANDARD_FEATURES, ...VOICE_FEATURES.slice(1)] as const;

/**
 * Free tier limits. Deliberately generous on everything that costs nothing —
 * Stella's reviews are full of people angry at a three-listens-a-day cap, and a
 * paywall that makes the app useless mostly produces uninstalls.
 *
 * Narration is the exception, and it is a taste rather than an allowance: three
 * in total, not three a day. Three costs about 60c to give away, which is a
 * reasonable price for letting somebody hear the thing they'd be buying. Three
 * a day would be $18 a month, per person, for people who may never pay.
 */
export const FREE_LIMITS = {
  storiesPerRefresh: 3,
  coachMessagesPerDay: 5,
  aiAffirmationBatches: 1,
} as const;

/**
 * How much narration each tier may commission.
 *
 * `perDay` bounds a single day's spend; `total` bounds it over the account's
 * whole life (free only); `perMonth` bounds the tail so one enthusiastic user
 * can't outrun the subscription that's paying for them.
 *
 * The voice figures: 45 a month at ~20c each is about $9 in the worst case,
 * against $14.99 gross — roughly $10.50 after the store's cut. Thin at the
 * ceiling, comfortable at the fifteen-or-so a month most people will actually
 * play. The daily cap of 3 exists so a single evening can't consume the month.
 */
export const NARRATION_ALLOWANCE: Record<
  PlanTier,
  { perDay: number; perMonth: number; total: number | null }
> = {
  free: { perDay: 1, perMonth: 3, total: 3 },
  standard: { perDay: 0, perMonth: 0, total: 0 },
  voice: { perDay: 3, perMonth: 45, total: null },
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
