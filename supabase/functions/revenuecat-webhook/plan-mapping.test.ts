import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FALLBACK_PLAN,
  mappedProductIds,
  normaliseProductId,
  planForProduct,
} from "./plan-mapping.ts";

/**
 * This webhook decides who has paid for what. It is the only writer of the
 * `subscriptions` table, and `narrate-story` reads that table to decide
 * whether to spend ElevenLabs money on somebody.
 *
 * So a wrong answer here is never cosmetic. It is either giving away the
 * expensive tier or withholding a tier somebody is paying for — and because
 * the fallback quietly grants Standard, the second kind looks like nothing at
 * all until a subscriber writes in.
 */

describe("normaliseProductId", () => {
  /**
   * Google's subscription model separates a product from its base plan and
   * RevenueCat reports them joined by a colon. Apple sends the bare id.
   */
  it("strips Google's base plan suffix", () => {
    expect(normaliseProductId("com.manifestai.voice.yearly:yearly")).toBe(
      "com.manifestai.voice.yearly",
    );
  });

  it("leaves Apple's bare identifier alone", () => {
    expect(normaliseProductId("com.manifestai.voice.yearly")).toBe("com.manifestai.voice.yearly");
  });

  it("returns an empty string for nothing, rather than throwing", () => {
    expect(normaliseProductId(null)).toBe("");
    expect(normaliseProductId(undefined)).toBe("");
  });
});

describe("planForProduct", () => {
  /**
   * The exact failure this file was written to fix. On Android a Voice
   * subscriber's product arrives with the base plan appended, missed the map,
   * and fell through to FALLBACK_PLAN — Standard. They paid $6.99 a week for
   * narration and were recorded as having no narration at all.
   */
  it("maps a Play identifier that carries its base plan", () => {
    expect(planForProduct("com.manifestai.voice.weekly:weekly")).toBe("voice_weekly");
    expect(planForProduct("com.manifestai.voice.monthly:monthly")).toBe("voice_monthly");
    expect(planForProduct("com.manifestai.voice.yearly:yearly")).toBe("voice_yearly");
  });

  /** The other half of the same bug: weekly was never in the map. */
  it("knows the weekly plans exist", () => {
    expect(planForProduct("com.manifestai.standard.weekly")).toBe("standard_weekly");
    expect(planForProduct("com.manifestai.voice.weekly")).toBe("voice_weekly");
  });

  it("maps Apple's bare identifiers", () => {
    expect(planForProduct("com.manifestai.standard.monthly")).toBe("standard_monthly");
    expect(planForProduct("com.manifestai.standard.lifetime")).toBe("standard_lifetime");
  });

  /**
   * Pre-split subscriptions were sold as "everything", narration included.
   * Remapping them to Standard would take away something already paid for.
   */
  it("keeps narration for subscriptions sold before the split", () => {
    expect(planForProduct("com.manifestai.premium.monthly")).toBe("monthly");
    expect(planForProduct("com.manifestai.premium.yearly")).toBe("yearly");
    expect(planForProduct("com.manifestai.premium.lifetime")).toBe("lifetime");
  });

  /**
   * Null, not the fallback. The caller must be able to tell an unknown product
   * from a real Standard monthly, or the UNMAPPED warning never fires and the
   * next missing product goes unnoticed exactly as weekly did.
   */
  it("returns null for anything it doesn't recognise", () => {
    expect(planForProduct("com.manifestai.voice.daily")).toBeNull();
    expect(planForProduct("")).toBeNull();
    expect(planForProduct(undefined)).toBeNull();
  });

  /** Whatever the fallback is, it must never be a tier that carries voice. */
  it("falls back to a plan that does not include narration", () => {
    expect(FALLBACK_PLAN).toBe("standard_monthly");
    expect(FALLBACK_PLAN.startsWith("voice")).toBe(false);
    expect(["monthly", "yearly", "lifetime"]).not.toContain(FALLBACK_PLAN);
  });
});

/**
 * The parity check that would have caught this on the day the weekly plans
 * were added.
 *
 * Deno can't import from `src/`, so the plan ids are read out of `plans.ts` by
 * parsing it — the same approach `allowance-parity.test.ts` uses for the
 * narration cap. Blunt, but it fails loudly at the moment somebody adds a plan
 * to the app and forgets the webhook, which is the only moment that matters.
 */
describe("parity with the app's own plan list", () => {
  const PLANS_TS = resolve(import.meta.dirname, "../../../src/features/billing/plans.ts");

  function productIdsFromPlansTs(): string[] {
    const source = readFileSync(PLANS_TS, "utf8");
    return [...source.matchAll(/productId:\s*"([^"]+)"/g)].map((m) => m[1]!);
  }

  it("maps every product the app can sell", () => {
    const selling = productIdsFromPlansTs();
    expect(selling.length).toBeGreaterThan(0);

    const unmapped = selling.filter((id) => planForProduct(id) === null);
    expect(unmapped).toEqual([]);
  });

  it("maps each product to the plan id the app uses for it", () => {
    const source = readFileSync(PLANS_TS, "utf8");
    // id: "voice_weekly", ... productId: "com.manifestai.voice.weekly"
    const pairs = [...source.matchAll(/id:\s*"([a-z_]+)",[\s\S]{0,400}?productId:\s*"([^"]+)"/g)];
    expect(pairs.length).toBeGreaterThan(0);

    for (const [, planId, productId] of pairs) {
      expect(planForProduct(productId!)).toBe(planId!);
    }
  });

  it("does not map products the app no longer sells, except the legacy three", () => {
    const selling = new Set(productIdsFromPlansTs());
    const legacy = new Set([
      "com.manifestai.premium.monthly",
      "com.manifestai.premium.yearly",
      "com.manifestai.premium.lifetime",
    ]);

    for (const mapped of mappedProductIds()) {
      if (legacy.has(mapped)) continue;
      expect(selling.has(mapped)).toBe(true);
    }
  });
});
