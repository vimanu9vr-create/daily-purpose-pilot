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
   * One share link covers all three billing periods. Without `enabled` the
   * checkout opens on whichever period is starred in the dashboard — so
   * somebody who chose Yearly would be shown Monthly, pay less than they
   * agreed to, and have every right to be annoyed about it.
   */
  it("narrows a multi-period product to the period the person chose", () => {
    const url = new URL(checkoutUrl(variant, "user-1"));
    expect(url.searchParams.get("enabled")).toBe(variant.variantId);
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
   * Checkout UUIDs repeat — one per product, shared by its billing periods —
   * but a numeric variant id identifies exactly one thing we can sell. Two
   * plans sharing one would mean a payment credited to the wrong tier, and
   * since the fallback grants access rather than refusing it, nobody would
   * find out until a Standard subscriber asked why the narration was missing.
   */
  it("gives each plan its own variant number", () => {
    const numbers = Object.values(LEMON_VARIANTS).map((v) => v!.variantId);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("groups the billing periods of a product under one checkout", () => {
    expect(LEMON_VARIANTS.standard_monthly!.checkout).toBe(LEMON_VARIANTS.standard_yearly!.checkout);
    expect(LEMON_VARIANTS.voice_monthly!.checkout).toBe(LEMON_VARIANTS.voice_yearly!.checkout);
    // Lifetime is a separate product — a one-off payment can't sit in a
    // subscription product, so it must not share Standard's checkout.
    expect(LEMON_VARIANTS.standard_lifetime!.checkout).not.toBe(
      LEMON_VARIANTS.standard_monthly!.checkout,
    );
  });
});
