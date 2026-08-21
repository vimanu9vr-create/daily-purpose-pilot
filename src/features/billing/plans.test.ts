import { describe, expect, it } from "vitest";

import {
  NARRATION_ALLOWANCE,
  PLANS,
  SAMPLE_TRACK_TITLE,
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
  /**
   * There is no free trial, and this is the test that says so.
   *
   * A per-user trial is a per-user bill. At a thousand installs a month it
   * cost more than every paying subscriber's listening combined, spent mostly
   * on people who never came back. Voice is the ONLY tier that commissions
   * audio; what everybody else can hear is one shared sample.
   */
  it("commissions narration for voice and nobody else", () => {
    expect(NARRATION_ALLOWANCE.free).toEqual({ perDay: 0, perMonth: 0 });
    expect(NARRATION_ALLOWANCE.standard).toEqual({ perDay: 0, perMonth: 0 });
    expect(NARRATION_ALLOWANCE.voice.perDay).toBeGreaterThan(0);
  });

  it("names a sample track, so the paywall isn't selling a voice nobody has heard", () => {
    expect(SAMPLE_TRACK_TITLE.length).toBeGreaterThan(0);
  });

  /**
   * The ceiling has to stay affordable, so the arithmetic is asserted rather
   * than left in a comment where it can quietly stop being true.
   *
   * 2,139 characters is the measured average story on production. ElevenLabs
   * Creator is $22 for 121,000 credits (August 2026), and Flash bills half a
   * credit per character. Apple and Google both take 15% below $1M a year.
   */
  const AVG_CHARS = 2139;
  const COST_PER_CREDIT = 22 / 121_000;
  const STORE_FEE = 0.15;
  const costOf = (listens: number) => listens * AVG_CHARS * 0.5 * COST_PER_CREDIT;

  /**
   * Checked against the YEARLY plan, deliberately.
   *
   * This test is here because the first version of these numbers was checked
   * against the monthly price and passed, while the yearly plan — which costs
   * the subscriber less per month for exactly the same allowance — lost money
   * at the ceiling. A cap has to be survivable on the cheapest plan that
   * carries it, not the dearest, or the app loses money precisely when
   * somebody loves it.
   */
  it("survives a worst-case month on the cheapest plan that includes voice", () => {
    const cheapestVoicePerMonth = 119.99 / 12;
    const netRevenue = cheapestVoicePerMonth * (1 - STORE_FEE);

    expect(costOf(NARRATION_ALLOWANCE.voice.perMonth)).toBeLessThan(netRevenue);
  });

  it("keeps the daily cap inside the monthly one", () => {
    expect(NARRATION_ALLOWANCE.voice.perDay).toBeLessThan(NARRATION_ALLOWANCE.voice.perMonth);
  });

  /**
   * The sample is a fixed cost, not a per-user one, and that is the entire
   * point of it. One render serves every install the app ever gets.
   */
  it("costs the same to demo the voice to ten people or ten thousand", () => {
    expect(costOf(1)).toBeLessThan(0.5);
  });
});
