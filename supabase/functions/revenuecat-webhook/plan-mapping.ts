/**
 * Store product identifier → the plan we record on the subscription row.
 *
 * Split out of `index.ts` so it can be tested from Node. `index.ts` is Deno
 * code with `Deno.serve` at the top level and cannot be imported by Vitest,
 * which is how the two bugs below survived: nothing could reach them.
 *
 * The plan string written here is what `narrate-story` later reads to decide
 * whether somebody may commission narration. A wrong entry is not a display
 * bug — it either gives the expensive tier away or withholds a paid one.
 */

/**
 * ## The two bugs this file was created to fix
 *
 * **1. The weekly plans were missing entirely.** They were added to
 * `plans.ts`, to the landing page and to Play Console, but never here. A
 * weekly subscriber fell through to FALLBACK_PLAN.
 *
 * **2. Google appends the base plan to the product id.** Play's subscription
 * model separates a product from its base plan, and RevenueCat reports the
 * pair joined by a colon:
 *
 *     com.manifestai.voice.yearly:yearly
 *
 * That is not a key in this map. Apple sends the bare id, so the map worked on
 * iOS and failed on every Android subscription.
 *
 * Together they meant an Android subscriber paying $6.99 a week for Voice was
 * recorded as `standard_monthly` and got no narration — the one feature they
 * were paying for, silently withheld, with the fallback's warning buried in
 * logs nobody reads until someone complains.
 */
const PLAN_BY_PRODUCT: Record<string, string> = {
  "com.manifestai.standard.weekly": "standard_weekly",
  "com.manifestai.standard.monthly": "standard_monthly",
  "com.manifestai.standard.yearly": "standard_yearly",
  "com.manifestai.standard.lifetime": "standard_lifetime",
  "com.manifestai.voice.weekly": "voice_weekly",
  "com.manifestai.voice.monthly": "voice_monthly",
  "com.manifestai.voice.yearly": "voice_yearly",

  // Sold before the Standard / Voice split. They included narration, so they
  // keep it.
  "com.manifestai.premium.monthly": "monthly",
  "com.manifestai.premium.yearly": "yearly",
  "com.manifestai.premium.lifetime": "lifetime",
};

/**
 * What to record when the product isn't in that map.
 *
 * It used to be "monthly" — which, after the split, is the LEGACY id and maps
 * to the voice tier. So a typo in App Store Connect, or a product created and
 * not added here, would have handed the dearest plan to somebody paying for
 * the cheapest, silently.
 *
 * Standard is the safe direction to be wrong in. The person has paid and gets
 * the base paid tier immediately, nobody is handed narration by accident, and
 * the error is logged loudly. Refusing outright is worse: it takes money and
 * grants nothing.
 */
export const FALLBACK_PLAN = "standard_monthly";

/**
 * Strips Google's base plan suffix, leaving the product id itself.
 *
 * `com.manifestai.voice.yearly:yearly` -> `com.manifestai.voice.yearly`
 * `com.manifestai.voice.yearly`        -> unchanged (Apple, and web)
 */
export function normaliseProductId(productId: string | null | undefined): string {
  return (productId ?? "").split(":")[0] ?? "";
}

/**
 * The plan for a store product, or null when we don't recognise it.
 *
 * Null rather than the fallback, deliberately: the caller needs to know the
 * difference so it can log an UNMAPPED PRODUCT warning. Returning the fallback
 * here would make an unknown product indistinguishable from a real Standard
 * monthly subscription, which is exactly the kind of silence that let the
 * weekly plans go missing for as long as they did.
 */
export function planForProduct(productId: string | null | undefined): string | null {
  const normalised = normaliseProductId(productId);
  if (!normalised) return null;
  return PLAN_BY_PRODUCT[normalised] ?? null;
}

/** Every product id this webhook knows how to map. Used by the parity test. */
export function mappedProductIds(): string[] {
  return Object.keys(PLAN_BY_PRODUCT);
}
