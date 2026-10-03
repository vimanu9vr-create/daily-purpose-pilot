import { describe, expect, it } from "vitest";

import { LEMON_VARIANTS, checkoutUrl } from "./lemon";
import { PLANS } from "./plans";

/**
 * These tests exist because the first attempt at this file 404'd on every
 * plan, and nothing caught it until somebody clicked Subscribe.
 *
 * The lesson wasn't "write more tests" — there were tests. It was that they
 * asserted the two identifiers matched each other, when the whole point is
 * that they are different things. So these assert on SHAPE and on the URL
 * that actually gets opened.
 */
describe("checkoutUrl", () => {
  const variant = LEMON_VARIANTS.standard_yearly!;

  it("opens the product UUID, never the numeric variant id", () => {
    const url = new URL(checkoutUrl(variant, "user-1"));
    expect(url.pathname).toBe(`/checkout/buy/${variant.checkout}`);
    expect(url.pathname).not.toContain(variant.variantId);
  });

  /**
   * Each plan is its own single-variant product now, so the URL alone decides
   * what is bought. Sending a variant parameter as well would be a second
   * source of truth for the same question, and the first thing to go wrong
   * when a product is ever recreated.
   */
  it("does not try to select a variant", () => {
    const url = new URL(checkoutUrl(variant, "user-1"));
    expect(url.searchParams.has("enabled")).toBe(false);
  });

  /**
   * The webhook has no other way to know whose row to write. Email is not a
   * substitute: people pay with a different address than they signed up with.
   */
  it("carries the user id through to the webhook", () => {
    const url = new URL(checkoutUrl(variant, "user-42"));
    expect(url.searchParams.get("checkout[custom][user_id]")).toBe("user-42");
  });

  it("prefills the email when we know it, and omits it when we don't", () => {
    const withEmail = new URL(checkoutUrl(variant, "u", "a@b.com"));
    expect(withEmail.searchParams.get("checkout[email]")).toBe("a@b.com");
    expect(new URL(checkoutUrl(variant, "u")).searchParams.has("checkout[email]")).toBe(false);
  });
});

describe("LEMON_VARIANTS", () => {
  it("offers every paid plan on the web", () => {
    const missing = PLANS.filter((plan) => !LEMON_VARIANTS[plan.id]).map((plan) => plan.id);
    expect(missing).toEqual([]);
  });

  it("holds a UUID for checkout and a number for the webhook, never the reverse", () => {
    for (const [planId, variant] of Object.entries(LEMON_VARIANTS)) {
      expect(variant!.checkout, `${planId} checkout`).toMatch(/^[0-9a-f-]{36}$/i);
      expect(variant!.variantId, `${planId} variantId`).toMatch(/^\d+$/);
    }
  });

  /**
   * One product per plan means both identifiers must be unique. A repeated
   * checkout UUID would charge someone the wrong price; a repeated variant
   * number would credit the payment to the wrong tier — and because the
   * fallback grants access rather than refusing it, nobody would find out
   * until a Standard subscriber asked where the narration went.
   *
   * This is the assertion that would have caught a copy-paste slip in the
   * seven lines above, which is the only way this data ever gets entered.
   */
  it("gives each plan its own checkout link and its own variant number", () => {
    const checkouts = Object.values(LEMON_VARIANTS).map((v) => v!.checkout);
    const numbers = Object.values(LEMON_VARIANTS).map((v) => v!.variantId);
    expect(new Set(checkouts).size, "two plans share a checkout link").toBe(checkouts.length);
    expect(new Set(numbers).size, "two plans share a variant number").toBe(numbers.length);
  });
});
