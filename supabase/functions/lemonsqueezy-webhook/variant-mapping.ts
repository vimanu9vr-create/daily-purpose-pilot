/**
 * Lemon Squeezy variant id → our plan id.
 *
 * Deno can't import from `src/`, so this is a second copy of a mapping that
 * also exists in `src/features/billing/lemon.ts`. That duplication is exactly
 * how the RevenueCat webhook ended up recording Voice subscribers as Standard
 * for weeks — so `variant-mapping.test.ts` parses the TypeScript file and
 * fails the build if the two ever disagree.
 *
 * FILL THIS IN alongside LEMON_VARIANTS. Both must list the same variants.
 */

import type { PlanId } from "./plan-ids.ts";

export const VARIANT_TO_PLAN: Record<string, PlanId> = {
  // "123456": "standard_weekly",
  // "123457": "standard_monthly",
  // "123458": "standard_yearly",
  // "123459": "standard_lifetime",
  // "123460": "voice_weekly",
  // "123461": "voice_monthly",
  // "123462": "voice_yearly",
};

/**
 * What to grant when a variant isn't recognised.
 *
 * Standard monthly, never a voice tier. An unknown product should cost us the
 * cheapest thing we could have given away, not the most expensive — and the
 * same reasoning is written out at length in the RevenueCat mapping, where
 * getting it the wrong way round would have handed out free narration.
 */
export const FALLBACK_PLAN: PlanId = "standard_monthly";

export function planForVariant(variantId: string | number | null | undefined): PlanId | null {
  if (variantId === null || variantId === undefined) return null;
  return VARIANT_TO_PLAN[String(variantId)] ?? null;
}

export function mappedVariantIds(): string[] {
  return Object.keys(VARIANT_TO_PLAN);
}
