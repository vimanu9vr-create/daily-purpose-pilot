import { describe, expect, it } from "vitest";

import {
  NARRATION_ALLOWANCE,
  PLANS,
  STANDARD_PLANS,
  VOICE_PLANS,
  includesVoice,
  planById,
  tierOf,
} from "./plans";

describe("plan tiers", () => {
  it("gives voice only to the voice plans", () => {
    for (const plan of VOICE_PLANS) expect(includesVoice(plan.id)).toBe(true);
    for (const plan of STANDARD_PLANS) expect(includesVoice(plan.id)).toBe(false);
  });

  /**
   * The one that matters most.
   *
   * Rows sold before the split say `monthly` / `yearly` / `lifetime`, and they
   * were sold with narration included. If this ever returns "standard", every
   * existing paying customer opens the app to find the voice gone — which is
   * taking something back that they paid for.
   */
  it("keeps narration for subscriptions sold before the split", () => {
    for (const legacy of ["monthly", "yearly", "lifetime"]) {
      expect(tierOf(legacy)).toBe("voice");
    }
  });

  it("treats anything unrecognised as free rather than as paid", () => {
    for (const unknown of [null, undefined, "", "premium", "voice_weekly", "STANDARD_MONTHLY"]) {
      expect(tierOf(unknown)).toBe("free");
    }
  });

  it("declares its own tier on every plan, matching what tierOf derives", () => {
    for (const plan of PLANS) expect(tierOf(plan.id)).toBe(plan.tier);
  });

  it("has a distinct store product id for every plan", () => {
    const ids = PLANS.map((plan) => plan.productId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toBeTruthy();
  });

  it("can look a plan up by the id stored on a subscription row", () => {
    expect(planById("voice_yearly")?.tier).toBe("voice");
    expect(planById("standard_lifetime")?.tier).toBe("standard");
  });
});

describe("narration allowance", () => {
  it("gives standard no narration at all", () => {
    expect(NARRATION_ALLOWANCE.standard.perDay).toBe(0);
    expect(NARRATION_ALLOWANCE.standard.perMonth).toBe(0);
  });

  /**
   * A paid tier that gets less than free would be indefensible, and it is an
   * easy thing to introduce by tuning one number without looking at the other.
   * Free's narration is a trial with a lifetime total; voice has no total at
   * all, so this compares the thing that actually differs.
   */
  it("never lets free out-listen voice", () => {
    expect(NARRATION_ALLOWANCE.voice.perDay).toBeGreaterThan(NARRATION_ALLOWANCE.free.perDay);
    expect(NARRATION_ALLOWANCE.voice.perMonth).toBeGreaterThan(NARRATION_ALLOWANCE.free.perMonth);
    expect(NARRATION_ALLOWANCE.voice.total).toBeNull();
  });

  it("makes free a trial that ends rather than an allowance that resets forever", () => {
    expect(NARRATION_ALLOWANCE.free.total).not.toBeNull();
  });

  /**
   * The ceiling has to stay affordable, so the arithmetic is asserted rather
   * than left in a comment where it can quietly stop being true.
   *
   * 2,139 characters is the measured average story on production. ElevenLabs
   * Creator is $22 for 121,000 credits (August 2026), and Flash bills half a
   * credit per character. Voice grosses $14.99, of which roughly $10.49 is left
   * after the store's 30% cut.
   */
  it("keeps a worst-case month of voice inside what the plan charges", () => {
    const AVG_CHARS = 2139;
    const COST_PER_CREDIT = 22 / 121_000;
    const worstCase = NARRATION_ALLOWANCE.voice.perMonth * AVG_CHARS * 0.5 * COST_PER_CREDIT;
    const netRevenue = 14.99 * 0.7;

    expect(worstCase).toBeLessThan(netRevenue);
  });

  it("keeps the free trial cheap enough to give to someone who never pays", () => {
    const AVG_CHARS = 2139;
    const COST_PER_CREDIT = 22 / 121_000;
    const total = NARRATION_ALLOWANCE.free.total ?? 0;
    expect(total * AVG_CHARS * 0.5 * COST_PER_CREDIT).toBeLessThan(1);
  });
});
