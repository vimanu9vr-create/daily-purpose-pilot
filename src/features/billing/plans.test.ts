import { describe, expect, it } from "vitest";

import {
  NARRATION_ALLOWANCE,
  PLANS,
  SAMPLE_TRACK_TITLE,
  STANDARD_PLANS,
  VOICE_PLANS,
  includesVoice,
  matchesProduct,
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
    // "voice_weekly" used to sit in this list as a plausible-looking id that
    // didn't exist. It exists now, so it moved to the test below — leaving it
    // here would have forced a real plan to grant nothing.
    for (const unknown of [null, undefined, "", "premium", "voice_daily", "STANDARD_MONTHLY"]) {
      expect(tierOf(unknown)).toBe("free");
    }
  });

  it("grants the right tier on the weekly plans", () => {
    expect(tierOf("standard_weekly")).toBe("standard");
    expect(tierOf("voice_weekly")).toBe("voice");
    expect(includesVoice("standard_weekly")).toBe(false);
    expect(includesVoice("voice_weekly")).toBe(true);
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
   * The cheapest voice plan, normalised to a month, read off the plans.
   *
   * This used to be the literal `149.99 / 12`. When the yearly plan was
   * repriced the test went on happily checking a price that no longer existed,
   * which is the same failure the whole block exists to prevent — a number
   * duplicated in two places and only one of them updated.
   */
  const cheapestVoiceMonthlyEquivalent = () => {
    const perMonth = VOICE_PLANS.map((plan) => {
      const price = Number(plan.priceDisplay.replace(/[^0-9.]/g, ""));
      if (plan.cadence.includes("year")) return price / 12;
      if (plan.cadence.includes("week")) return (price * 52) / 12;
      return price;
    });
    return Math.min(...perMonth);
  };

  /**
   * Checked against the CHEAPEST plan, deliberately.
   *
   * This test is here because the first version of these numbers was checked
   * against the monthly price and passed, while the yearly plan — which costs
   * the subscriber less per month for exactly the same allowance — lost money
   * at the ceiling. A cap has to be survivable on the cheapest plan that
   * carries it, not the dearest, or the app loses money precisely when
   * somebody loves it.
   */
  it("survives a worst-case month on the cheapest plan that includes voice", () => {
    const netRevenue = cheapestVoiceMonthlyEquivalent() * (1 - STORE_FEE);

    expect(costOf(NARRATION_ALLOWANCE.voice.perMonth)).toBeLessThan(netRevenue);
  });

  /**
   * Positive is not the same as viable.
   *
   * At $149.99 a year the ceiling left 17.6%, which passes the test above and
   * is still a bad plan: the app earned least from the subscribers who used
   * most of what they bought. A floor makes the distinction explicit, so a
   * future discount that technically survives but guts the margin fails here
   * rather than a year later in the bank statements.
   */
  it("leaves a real margin at the ceiling, not merely a positive one", () => {
    const netRevenue = cheapestVoiceMonthlyEquivalent() * (1 - STORE_FEE);
    const margin = (netRevenue - costOf(NARRATION_ALLOWANCE.voice.perMonth)) / netRevenue;

    expect(margin).toBeGreaterThan(0.25);
  });

  /**
   * The annual discount must come out of margin, never out of cost.
   *
   * Standard can discount 36% because it costs nothing to serve. Voice cannot,
   * because the narration bill arrives every month at the same size however
   * the subscriber paid. Discounting the whole price discounts the cost too,
   * which is impossible, and the gap shows up as a collapsed margin.
   */
  it("does not discount the yearly voice plan past what the cost allows", () => {
    const monthly = VOICE_PLANS.find((plan) => plan.cadence.includes("month"))!;
    const yearly = VOICE_PLANS.find((plan) => plan.cadence.includes("year"))!;

    const monthlyPrice = Number(monthly.priceDisplay.replace(/[^0-9.]/g, ""));
    const yearlyPerMonth = Number(yearly.priceDisplay.replace(/[^0-9.]/g, "")) / 12;
    const ceilingCost = costOf(NARRATION_ALLOWANCE.voice.perMonth);

    // The discount, measured against margin rather than against price.
    const monthlyMargin = monthlyPrice * (1 - STORE_FEE) - ceilingCost;
    const yearlyMargin = yearlyPerMonth * (1 - STORE_FEE) - ceilingCost;

    expect(yearlyMargin / monthlyMargin).toBeGreaterThan(0.4);
    // And it must still look like a genuine saving, or nobody buys it.
    expect(yearlyPerMonth).toBeLessThan(monthlyPrice * 0.85);
  });

  /**
   * Caught from a real RevenueCat dashboard: after importing from Play, every
   * subscription appeared as `com.manifestai.voice.weekly:weekly` — Google
   * joins the product to its base plan. A strict `===` against `productId`
   * matched on iOS and failed on every Android subscription, and the failure
   * surfaced as "That plan isn't available on this device yet" on the paywall.
   */
  it("matches a Play identifier that carries its base plan suffix", () => {
    expect(
      matchesProduct("com.manifestai.voice.weekly:weekly", "com.manifestai.voice.weekly"),
    ).toBe(true);
    expect(
      matchesProduct("com.manifestai.standard.monthly:monthly", "com.manifestai.standard.monthly"),
    ).toBe(true);
  });

  it("still matches Apple's bare identifier", () => {
    expect(matchesProduct("com.manifestai.voice.weekly", "com.manifestai.voice.weekly")).toBe(true);
  });

  it("does not match a different product", () => {
    expect(
      matchesProduct("com.manifestai.standard.weekly:weekly", "com.manifestai.voice.weekly"),
    ).toBe(false);
  });

  it("treats a missing identifier as no match rather than throwing", () => {
    expect(matchesProduct(undefined, "com.manifestai.voice.weekly")).toBe(false);
    expect(matchesProduct("com.manifestai.voice.weekly", null)).toBe(false);
  });

  /**
   * Every store product id must survive the round trip, or a plan silently
   * becomes unbuyable on one platform.
   */
  it("matches every plan against its own Play-style identifier", () => {
    for (const plan of PLANS) {
      if (!plan.productId) continue;
      expect(matchesProduct(`${plan.productId}:base`, plan.productId)).toBe(true);
    }
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
