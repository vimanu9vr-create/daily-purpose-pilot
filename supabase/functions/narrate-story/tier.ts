/**
 * Plan id → tier, for the narration gate.
 *
 * Split out of `index.ts` for the same reason `plan-mapping.ts` was split out
 * of the RevenueCat webhook: `index.ts` is Deno code with `Deno.serve` at the
 * top level, so Vitest cannot import it, so nothing could ever test this. That
 * is precisely how the bug below survived.
 *
 * ## The bug
 *
 * Both weekly plans were missing from the switch, and the `default` branch
 * returns "free". A weekly Voice subscriber paying $6.99 was refused narration
 * — the only thing that tier exists to sell — and a weekly Standard subscriber
 * was treated as if they had never paid.
 *
 * The identical omission had already been found and fixed once, in
 * `revenuecat-webhook/plan-mapping.ts`, whose own comment opens with "the
 * weekly plans were missing entirely". Fixing one copy of a hand-maintained
 * mapping does not fix the others, and there is no type that connects them.
 * `tier.test.ts` now reads the plan ids out of `src/features/billing/plans.ts`
 * and fails if any of them land on "free" here.
 *
 * This copy is the one that decides. The client's copy in `plans.ts` only
 * controls what gets drawn on screen — a gate that lives on the client is a
 * suggestion.
 */

export type Tier = "free" | "standard" | "voice";

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
      // Unknown ids fail closed. That is the right direction — better to
      // refuse a paid feature than hand out ElevenLabs minutes — but it is
      // silent, which is why the missing weekly plans went unnoticed for so
      // long. The test is what makes the silence safe.
      return "free";
  }
}
