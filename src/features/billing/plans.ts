/**
 * Plans, tiers, and what each one unlocks.
 *
 * ## Why there are two paid plans instead of one
 *
 * Everything in this app except narration is nearly free to serve. Text
 * generation runs on Gemini Flash; photographs come from Pexels' free
 * allowance; the database is a rounding error. Studio narration is the only
 * thing with a large per-use bill.
 *
 * "Nearly", not "free", and the difference matters at scale. This file used to
 * say text was free because it ran on Gemini's free tier — but a free tier is
 * a rate limit on the PROJECT, not an allowance per user, so it stops being
 * the relevant number the moment there is real traffic. At paid rates
 * (gemini-2.5-flash, $0.30 per million input tokens and $2.50 per million
 * output, checked September 2026) a heavy user costs roughly 16c a month in
 * text and a typical one a few cents.
 *
 * That is still two orders of magnitude below narration and does not change
 * any price here. It is written down because "free" was going to be believed
 * later by someone reading this file, and at a million users the difference
 * between "free" and "a few cents" is a real line in the accounts.
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
  | "standard_weekly"
  | "standard_monthly"
  | "standard_yearly"
  | "standard_lifetime"
  | "voice_weekly"
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
    /**
     * Weekly exists because of what the number looks like, not what it costs.
     *
     * "$2.49 a week" reads as nothing; "$45.99 a year" reads as a decision. For
     * somebody who has never heard of this app, the second one ends the visit.
     *
     * Be honest about the trade though: at $2.49 a week somebody pays about
     * $10.79 a month against $5.99 on the monthly plan. It converts better and
     * costs the user more, which is why it is offered ALONGSIDE monthly and
     * never instead of it. Anyone who looks can see both and choose.
     */
    id: "standard_weekly",
    tier: "standard",
    name: "Weekly",
    productId: "com.manifestai.standard.weekly",
    priceDisplay: "$2.49",
    cadence: "per week",
    blurb: "Try it for a week. Cancel any time.",
  },
  {
    id: "standard_monthly",
    tier: "standard",
    name: "Monthly",
    productId: "com.manifestai.standard.monthly",
    priceDisplay: "$5.99",
    cadence: "per month",
    blurb: "Cancel any time.",
  },
  {
    id: "standard_yearly",
    tier: "standard",
    name: "Yearly",
    productId: "com.manifestai.standard.yearly",
    priceDisplay: "$45.99",
    cadence: "per year",
    blurb: "Works out at $3.83 a month.",
    highlight: "Save 36%",
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
    id: "voice_weekly",
    tier: "voice",
    name: "Weekly",
    productId: "com.manifestai.voice.weekly",
    priceDisplay: "$6.99",
    cadence: "per week",
    blurb: "Hear the voice for a week. Cancel any time.",
  },
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
    /**
     * $179.99, raised from $149.99.
     *
     * ## Why an annual discount on Voice cannot match the one on Standard
     *
     * Standard yearly is 36% off monthly and that is free to give: Standard
     * costs almost nothing to serve, so the whole discount comes out of
     * margin that was never spent.
     *
     * Voice is not like that. It carries a bill that arrives every month at
     * the same size whether the subscriber paid monthly or annually. At
     * $149.99 the maths was:
     *
     *   gross $12.50/month, net of the 15% store fee $10.62
     *   ceiling cost, 45 narrations at ~19.4c    $8.75
     *   left over                                $1.87  — 17.6%
     *
     * A 37% discount had been applied to the whole price, which means 37% was
     * taken off the cost as well — except the cost does not discount. So the
     * plan kept 18 cents on the dollar precisely for the subscribers who used
     * what they paid for, and the app earned least from the people who loved
     * it most. That is the wrong shape, and it is the same mistake in a new
     * place: the note on NARRATION_ALLOWANCE warns about checking the cheapest
     * plan, and the cheapest plan was still the one that didn't work.
     *
     * The rule now: DISCOUNT THE MARGIN, NEVER THE COST. At $179.99:
     *
     *   gross $15.00/month, net $12.75
     *   ceiling cost                             $8.75
     *   left over                                $4.00  — 31%
     *
     * Still a real 25% saving against $19.99 monthly, still the best value in
     * the range, and it survives its own ceiling. A strict application of the
     * rule — discount only the $8.24 of monthly margin by 30% — would have
     * landed at about $205, which is more than this category will bear from a
     * new brand. $179.99 is the compromise, chosen deliberately rather than
     * arrived at.
     *
     * Note this is the ceiling, not the average. A subscriber at 40% of the
     * cap leaves about $9.25, which is the number the business actually runs
     * on. The ceiling only has to be survivable, not comfortable.
     */
    id: "voice_yearly",
    tier: "voice",
    name: "Yearly",
    productId: "com.manifestai.voice.yearly",
    priceDisplay: "$179.99",
    cadence: "per year",
    blurb: "Works out at $15 a month.",
    highlight: "Save 25%",
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
 * The voice figures, re-checked against elevenlabs.io/pricing in September
 * 2026. Creator is $22 for 121,000 credits and Flash v2.5 bills 0.5 credits
 * per character, so the 2,139-character average story costs:
 *
 *   2,139 x 0.5 x (22 / 121,000) = $0.194
 *
 * At a 15% store fee, with 45 narrations costing $8.75:
 *
 *   Voice weekly  nets $25.75/month — $17.00 left at the ceiling (66%)
 *   Voice monthly nets $16.99/month —  $8.24 left at the ceiling (49%)
 *   Voice yearly  nets $12.75/month —  $4.00 left at the ceiling (31%)
 *
 * THE YEARLY PLAN SETS THIS NUMBER, not the monthly or weekly one. Weekly at
 * $6.99 nets about $25.75 a month, far above the ceiling's cost — it is the
 * dearest plan, not the cheapest, so it does not constrain this figure. Sixty
 * a month still does not survive: it would cost $11.66 against $12.75, leaving
 * a dollar, which is not a margin. Check the cheapest plan that carries the
 * allowance, never the dearest. That mistake has now been made twice in this
 * file, and the parity test derives the cheapest plan rather than hardcoding
 * it so that a future repricing cannot make it a third time.
 *
 * Volume barely helps, which is worth knowing before assuming it will. Pro is
 * $99/600k credits and Business $990/6M, both about $0.000165 per credit
 * against Creator's $0.000182 — a 9% saving, not an order of magnitude. This
 * cost does not fall away as the app grows.
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
    case "standard_weekly":
    case "standard_monthly":
    case "standard_yearly":
    case "standard_lifetime":
      return "standard";
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

export function includesVoice(planId: string | null | undefined): boolean {
  return tierOf(planId) === "voice";
}

export function planById(id: string): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/**
 * Does a store's product identifier refer to this plan's product?
 *
 * ## Why this is not just `===`
 *
 * Google's subscription model separates the product from its BASE PLAN, and
 * RevenueCat surfaces Play subscriptions using both, joined by a colon:
 *
 *   com.manifestai.voice.weekly:weekly
 *
 * Apple has no such concept and reports the bare product id. So a strict
 * equality check against `productId` matches on iOS and fails on every Android
 * subscription — and it fails in the worst possible way. `purchase()` would
 * find no matching package and return "That plan isn't available on this
 * device yet", which reads like a store outage rather than a bug, on the one
 * screen where the app asks for money.
 *
 * Comparing the part before the colon works for both stores and stays correct
 * if a base plan is ever renamed, since the base plan id is a detail of how
 * Play prices a product rather than part of the product's identity.
 */
export function matchesProduct(
  storeIdentifier: string | null | undefined,
  productId: string | null | undefined,
): boolean {
  if (!storeIdentifier || !productId) return false;
  return storeIdentifier.split(":")[0] === productId.split(":")[0];
}

/** Display name for a tier, for the profile screen and receipts. */
export function tierName(tier: PlanTier): string {
  if (tier === "voice") return "Voice";
  if (tier === "standard") return "Standard";
  return "Free";
}
