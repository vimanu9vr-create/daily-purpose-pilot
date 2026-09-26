/**
 * The plan ids, repeated for Deno.
 *
 * `src/features/billing/plans.ts` is the source of truth and Deno cannot
 * import it. `variant-mapping.test.ts` reads that file and fails if this list
 * drifts from it.
 */
export type PlanId =
  | "free"
  | "standard_weekly"
  | "standard_monthly"
  | "standard_yearly"
  | "standard_lifetime"
  | "voice_weekly"
  | "voice_monthly"
  | "voice_yearly"
  // Sold before the Standard/Voice split, with narration included.
  | "monthly"
  | "yearly"
  | "lifetime";
