/**
 * Plans, and what each one unlocks.
 *
 * Prices here are display-only. On iOS the real price comes from StoreKit,
 * localised by Apple to the user's storefront — never hardcode a price as
 * truth, or someone in another currency sees a number that doesn't match
 * what they're charged.
 */

export type PlanId = "free" | "monthly" | "yearly" | "lifetime";

export type Plan = {
  id: PlanId;
  name: string;
  /** App Store Connect product identifier. */
  productId: string | null;
  priceDisplay: string;
  cadence: string;
  blurb: string;
  highlight?: string;
};

export const PLANS: Plan[] = [
  {
    id: "monthly",
    name: "Monthly",
    productId: "com.manifestai.premium.monthly",
    priceDisplay: "$8.99",
    cadence: "per month",
    blurb: "Everything, billed monthly. Cancel any time.",
  },
  {
    id: "yearly",
    name: "Yearly",
    productId: "com.manifestai.premium.yearly",
    priceDisplay: "$49.99",
    cadence: "per year",
    blurb: "Works out at $4.17 a month.",
    highlight: "Save 54%",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    productId: "com.manifestai.premium.lifetime",
    priceDisplay: "$129.99",
    cadence: "one payment",
    blurb: "Pay once. Yours permanently, including everything added later.",
  },
];

/** What a paying user gets. Written plainly — no vague "premium experience". */
export const PREMIUM_FEATURES = [
  "Unlimited stories, refreshed through the day",
  "Studio narration in a real human voice",
  "Unlimited affirmations written from your own words",
  "The full library — sleep, meditations, frequencies",
  "Unlimited coaching conversations",
  "Morning notifications",
] as const;

/**
 * Free tier limits. Deliberately generous enough to be genuinely usable —
 * Stella's reviews are full of people angry at a three-listens-a-day cap, and
 * a paywall that makes the app useless mostly produces uninstalls.
 */
export const FREE_LIMITS = {
  storiesPerRefresh: 3,
  studioNarrationsTotal: 2,
  coachMessagesPerDay: 5,
  aiAffirmationBatches: 1,
} as const;

export function planById(id: PlanId): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}
