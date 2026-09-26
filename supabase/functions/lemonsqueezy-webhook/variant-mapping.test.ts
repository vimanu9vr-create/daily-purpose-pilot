import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { FALLBACK_PLAN, mappedVariantIds, planForVariant } from "./variant-mapping.ts";

/**
 * The same parity check that the RevenueCat mapping has, for the same reason.
 *
 * The variant → plan map exists twice: once in `src/features/billing/lemon.ts`
 * for the browser, once here for Deno, because Deno cannot import from `src/`.
 * Two copies of a mapping is precisely how Voice subscribers ended up recorded
 * as Standard for weeks — and because the fallback grants access rather than
 * refusing it, that failure is silent until somebody writes in.
 */
describe("parity with the app's variant list", () => {
  const LEMON_TS = resolve(import.meta.dirname, "../../../src/features/billing/lemon.ts");

  /** Uncommented entries only — commented ones are not configured yet. */
  function variantsFromLemonTs(): Array<[string, string]> {
    const source = readFileSync(LEMON_TS, "utf8");
    const block = source.match(/LEMON_VARIANTS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
    return [...block.matchAll(/^\s*([a-z_]+):\s*"([^"]+)"/gm)].map((m) => [m[1]!, m[2]!]);
  }

  it("maps every variant the web store can sell", () => {
    const selling = variantsFromLemonTs();
    const unmapped = selling.filter(([, variantId]) => planForVariant(variantId) === null);
    expect(unmapped).toEqual([]);
  });

  it("maps each variant to the plan the app uses for it", () => {
    for (const [planId, variantId] of variantsFromLemonTs()) {
      expect(planForVariant(variantId)).toBe(planId);
    }
  });

  it("does not map a variant the app no longer sells", () => {
    const selling = new Set(variantsFromLemonTs().map(([, v]) => v));
    for (const mapped of mappedVariantIds()) {
      expect(selling.has(mapped)).toBe(true);
    }
  });

  /**
   * Both sides start empty and go live together. If one is filled in and the
   * other isn't, the tests above catch it — but only if somebody notices the
   * suite is passing vacuously, so this says it out loud.
   */
  it("is either configured on both sides or neither", () => {
    const web = variantsFromLemonTs().length;
    const server = mappedVariantIds().length;
    expect(
      web === server,
      `lemon.ts has ${web} variants, variant-mapping.ts has ${server} — fill in both`,
    ).toBe(true);
  });
});

describe("planForVariant", () => {
  it("returns null rather than the fallback for anything unknown", () => {
    // The caller must be able to tell an unmapped variant from a real
    // Standard monthly, or the UNMAPPED warning never fires.
    expect(planForVariant("999999")).toBeNull();
    expect(planForVariant(null)).toBeNull();
    expect(planForVariant(undefined)).toBeNull();
  });

  it("accepts the numeric ids Lemon Squeezy actually sends", () => {
    // variant_id arrives as a number in the JSON payload, not a string.
    expect(planForVariant(123456)).toBe(planForVariant("123456"));
  });

  it("falls back to a plan that carries no narration cost", () => {
    expect(FALLBACK_PLAN).toBe("standard_monthly");
    expect(FALLBACK_PLAN.startsWith("voice")).toBe(false);
    expect(["monthly", "yearly", "lifetime"]).not.toContain(FALLBACK_PLAN);
  });
});
