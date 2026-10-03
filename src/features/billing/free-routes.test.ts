import { describe, expect, it } from "vitest";

import { FREE_ROUTES, isFreeRoute } from "./free-routes";

describe("isFreeRoute", () => {
  it("allows every route on the list", () => {
    for (const route of FREE_ROUTES) expect(isFreeRoute(route), route).toBe(true);
  });

  /**
   * The bug this test exists for. `/app` is on the list, so a `startsWith`
   * check would make every single route under it free — the whole paywall
   * undone by one operator.
   */
  it("does not let /app being free make everything under it free", () => {
    for (const locked of [
      "/app/coach",
      "/app/goals",
      "/app/habits",
      "/app/journal",
      "/app/vision",
      "/app/progress",
      "/app/programmes",
      "/app/practice",
      "/app/voice-lab",
      "/app/gratitude",
      "/app/week",
      "/app/moments",
    ]) {
      expect(isFreeRoute(locked), locked).toBe(false);
    }
  });

  /**
   * Nested routes under a free parent are NOT free. Reading the library is
   * free; a generated story inside it is the product.
   */
  it("does not leak through child routes of a free route", () => {
    expect(isFreeRoute("/app/library/anything")).toBe(false);
    expect(isFreeRoute("/app/profile/billing")).toBe(false);
  });

  it("ignores trailing slashes, which the router produces either way", () => {
    expect(isFreeRoute("/app/")).toBe(true);
    expect(isFreeRoute("/app/upgrade/")).toBe(true);
    expect(isFreeRoute("/app/coach/")).toBe(false);
  });

  /**
   * Blocking the page that takes money, or the page with the sign-out button,
   * would be an unusually expensive bug and a hostile one respectively.
   */
  it("never blocks the paywall or the way out", () => {
    expect(isFreeRoute("/app/upgrade")).toBe(true);
    expect(isFreeRoute("/app/profile")).toBe(true);
  });
});
