import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackInitiateCheckout, trackSignUp } from "./meta-pixel";

/**
 * These tests run in node, where there is no `window`. The module reads
 * `window.fbq` rather than a bare global, because that is what the Meta
 * snippet actually installs — so the test has to provide a window or it is
 * testing the "no browser" branch nine times over and proving nothing.
 */
type TestWindow = { fbq?: unknown };

function setWindow(win: TestWindow | undefined): void {
  // Deleted rather than assigned undefined: `exactOptionalPropertyTypes` is on,
  // and it is also the more faithful simulation — during SSR `window` is
  // absent, not present-and-undefined.
  if (win === undefined) delete (globalThis as { window?: TestWindow }).window;
  else (globalThis as { window?: TestWindow }).window = win;
}

describe("meta pixel", () => {
  beforeEach(() => {
    setWindow({});
  });

  it("does nothing when there is no browser at all", () => {
    // Server-side render. Reading window would throw.
    setWindow(undefined);
    expect(() => trackInitiateCheckout("standard_weekly", 2.49)).not.toThrow();
  });

  it("does nothing when the pixel never loaded", () => {
    // An ad blocker, an offline phone, or no VITE_META_PIXEL_ID at all. None
    // of these may throw: a tracker that breaks the checkout page costs real
    // money, and the thing it was measuring is the thing it broke.
    expect(() => trackInitiateCheckout("standard_weekly", 2.49)).not.toThrow();
    expect(() => trackSignUp()).not.toThrow();
  });

  it("does nothing when fbq exists but is not callable", () => {
    // Some blockers replace fbq with a non-function stub rather than removing
    // it. Checking for presence rather than callability would throw here.
    setWindow({ fbq: { queue: [] } });
    expect(() => trackInitiateCheckout("standard_weekly", 2.49)).not.toThrow();
  });

  it("sends value and currency with a checkout", () => {
    const spy = vi.fn();
    setWindow({ fbq: spy });

    trackInitiateCheckout("standard_lifetime", 79);

    // Value matters: without it a $79 intent and a $2.49 one look identical,
    // and Meta optimises for whichever is easiest to click — the cheapest.
    expect(spy).toHaveBeenCalledWith("track", "InitiateCheckout", {
      content_name: "standard_lifetime",
      value: 79,
      currency: "USD",
    });
  });

  it("defaults to USD but allows an override", () => {
    const spy = vi.fn();
    setWindow({ fbq: spy });

    trackInitiateCheckout("standard_monthly", 7.99, "GBP");

    expect(spy).toHaveBeenCalledWith(
      "track",
      "InitiateCheckout",
      expect.objectContaining({ currency: "GBP" }),
    );
  });

  it("exports no purchase tracker", async () => {
    // Guards the decision rather than the code. Purchase cannot be observed
    // from a browser that never visits the payment page, so firing it here
    // would mean firing it on click — training Meta to find people who open
    // checkouts and leave. The webhook sends the real one.
    const mod = await import("./meta-pixel");
    expect("trackPurchase" in mod).toBe(false);
  });
});
