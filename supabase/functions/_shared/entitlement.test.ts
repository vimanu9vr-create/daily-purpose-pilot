import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { FREE_LIMITS, tierOf } from "./entitlement.ts";

const PLANS_TS = resolve(import.meta.dirname, "../../../src/features/billing/plans.ts");

/**
 * The plan ids the app can actually sell, read out of the source of truth.
 *
 * Parsed from text rather than imported, because that mirrors how the Deno
 * functions see the world: they cannot import from `src/`, so the only way to
 * know the copies have not drifted is to go and read the other file.
 */
function paidPlanIds(): string[] {
  const source = readFileSync(PLANS_TS, "utf8");
  const union = source.match(/export type PlanId =([\s\S]*?);/)?.[1] ?? "";
  return [...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!).filter((id) => id !== "free");
}

describe("tierOf", () => {
  it("reads a non-empty list of plans from plans.ts", () => {
    // Without this, a regex that stops matching turns every assertion below
    // into a loop over nothing — which passes, says nothing, and is the exact
    // shape of the failure this file exists to prevent.
    expect(paidPlanIds().length).toBeGreaterThanOrEqual(7);
  });

  /**
   * The assertion that would have caught the live bug. Both weekly plans were
   * missing from the switch and fell through to `default`, which returns free
   * — so a weekly Voice subscriber paying $6.99 was refused the one thing that
   * tier sells, and a weekly Standard subscriber was treated as never having
   * paid. Weekly is the cheapest way in and therefore where most people start.
   */
  it("grants a paid tier for every plan the app sells", () => {
    const free = paidPlanIds().filter((id) => tierOf(id) === "free");
    expect(free, "these plans are sold but the server treats them as free").toEqual([]);
  });

  it("agrees with the app about which tier each plan is", () => {
    // Not just "not free" — the right one. Giving a Standard subscriber the
    // voice tier costs roughly 39c a listen, every listen, forever.
    const source = readFileSync(PLANS_TS, "utf8");
    for (const id of paidPlanIds()) {
      if (id.startsWith("standard")) expect(tierOf(id), id).toBe("standard");
      if (id.startsWith("voice")) expect(tierOf(id), id).toBe("voice");
    }
    // The three bare ids predate the split and included narration.
    expect(source).toContain('| "monthly"');
    for (const legacy of ["monthly", "yearly", "lifetime"]) {
      expect(tierOf(legacy), legacy).toBe("voice");
    }
  });

  it("fails closed on anything it does not recognise", () => {
    expect(tierOf("standard_quarterly")).toBe("free");
    expect(tierOf(null)).toBe("free");
    expect(tierOf(undefined)).toBe("free");
  });
});

describe("FREE_LIMITS", () => {
  /**
   * The React copy and this copy are the same ceiling written twice. If they
   * drift, the app shows one number and the server enforces another, and the
   * person hits a wall the interface told them was further away.
   */
  it("matches the limits the app shows", () => {
    const source = readFileSync(PLANS_TS, "utf8");
    const block = source.match(/FREE_LIMITS = \{([\s\S]*?)\} as const;/)?.[1] ?? "";
    const app = Object.fromEntries(
      [...block.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1]!, Number(m[2])]),
    );
    expect(Object.keys(app).length, "could not parse FREE_LIMITS out of plans.ts").toBeGreaterThan(
      0,
    );
    expect(app).toEqual({ ...FREE_LIMITS });
  });
});
