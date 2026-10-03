import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { tierOf } from "./tier.ts";

/**
 * The plan ids the app can actually sell, read out of the source of truth.
 *
 * Parsed from text rather than imported because this mirrors how the Deno
 * function sees the world: it cannot import from `src/`, so the only way to
 * know the two have not drifted is to go and read the other file.
 */
function paidPlanIds(): string[] {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../../src/features/billing/plans.ts"),
    "utf8",
  );
  const union = source.match(/export type PlanId =([\s\S]*?);/)?.[1] ?? "";
  return [...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!).filter((id) => id !== "free");
}

describe("tierOf", () => {
  it("reads a non-empty list of plans from plans.ts", () => {
    // Without this, a regex that stops matching turns every assertion below
    // into a loop over nothing — which passes, loudly says nothing, and is the
    // exact shape of the failure this file exists to prevent.
    expect(paidPlanIds().length).toBeGreaterThanOrEqual(7);
  });

  /**
   * The assertion that would have caught the live bug: both weekly plans fell
   * through to `default` and were billed as free. Weekly is the cheapest way
   * in and therefore where most people start, so this was the entry point to
   * the entire paid product.
   */
  it("grants a paid tier for every plan the app sells", () => {
    const free = paidPlanIds().filter((id) => tierOf(id) === "free");
    expect(free, `these plans are sold but treated as free by the narration gate`).toEqual([]);
  });

  it("gives narration only to the voice tier", () => {
    expect(tierOf("voice_weekly")).toBe("voice");
    expect(tierOf("voice_monthly")).toBe("voice");
    expect(tierOf("voice_yearly")).toBe("voice");
    expect(tierOf("standard_weekly")).toBe("standard");
    expect(tierOf("standard_lifetime")).toBe("standard");
  });

  /**
   * Sold before the split as "everything", narration included. Honouring what
   * somebody actually bought matters more than tidiness — a paying user who
   * opens the app and finds the voice gone has been robbed, whatever the
   * migration notes say.
   */
  it("keeps narration for the pre-split plans", () => {
    expect(tierOf("monthly")).toBe("voice");
    expect(tierOf("yearly")).toBe("voice");
    expect(tierOf("lifetime")).toBe("voice");
  });

  it("fails closed on anything it does not recognise", () => {
    expect(tierOf("standard_quarterly")).toBe("free");
    expect(tierOf(null)).toBe("free");
    expect(tierOf(undefined)).toBe("free");
  });
});
