import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NARRATION_ALLOWANCE, VOICE_PLANS } from "./plans";

/**
 * The client and the server must agree about what a subscriber bought.
 *
 * ## Why this test exists
 *
 * `plans.ts` said Voice gets 4 a day and 45 a month, and the paywall sold
 * "around fifty narrations a month — four in a day". `narrate-story` enforced
 * 3 and 30. Nobody noticed, because the two numbers live in different
 * runtimes: the app is bundled by Vite, the function runs on Deno, and Deno
 * cannot import from `src/`. There was no shared module to keep honest and no
 * test that compared them.
 *
 * The person who would have noticed is a paying Voice subscriber on day
 * eleven, cut off at 30 after being sold 50, with nothing on screen explaining
 * why. That is the most expensive possible way to find a constant out of date.
 *
 * ## Why parse the file instead of sharing a module
 *
 * A shared file would have to be readable from both runtimes. Supabase deploys
 * each function as its own bundle, so a repo-relative import doesn't survive
 * deployment, and duplicating a JSON file just moves the drift somewhere less
 * visible.
 *
 * Reading the literal out of the deployed source is blunt, but it fails loudly
 * at exactly the moment somebody edits one and forgets the other — which is
 * the only moment that matters.
 */
const EDGE_FUNCTION = resolve(
  import.meta.dirname,
  "../../../supabase/functions/narrate-story/index.ts",
);

function allowanceFromEdgeFunction(): { perDay: number; perMonth: number } {
  const source = readFileSync(EDGE_FUNCTION, "utf8");
  const match = source.match(/voice:\s*\{\s*perDay:\s*(\d+),\s*perMonth:\s*(\d+)\s*\}/);
  if (!match) {
    throw new Error(
      "Could not find the voice allowance in narrate-story/index.ts. If the shape " +
        "of that constant changed, update this regex — do not delete the test.",
    );
  }
  return { perDay: Number(match[1]), perMonth: Number(match[2]) };
}

describe("narration allowance parity", () => {
  it("enforces server-side exactly what the client promises", () => {
    expect(allowanceFromEdgeFunction()).toEqual({
      perDay: NARRATION_ALLOWANCE.voice.perDay,
      perMonth: NARRATION_ALLOWANCE.voice.perMonth,
    });
  });

  /**
   * The marketing copy is a third copy of the same number, in prose. It said
   * "around fifty" while the server allowed thirty, which is not "around".
   */
  it("keeps the sales copy within reach of the real allowance", () => {
    const { perMonth, perDay } = NARRATION_ALLOWANCE.voice;
    // "Around fifty" has to be genuinely near fifty, not a rounded-up thirty.
    expect(perMonth).toBeGreaterThanOrEqual(45);
    expect(perDay).toBeGreaterThanOrEqual(4);
  });

  /**
   * Derived from the plans rather than hardcoded, so a future repricing can't
   * quietly invalidate the arithmetic the way the last one did.
   */
  it("stays affordable on the cheapest plan that carries voice", () => {
    const AVG_CHARS = 2139;
    const COST_PER_CREDIT = 22 / 121_000;
    const STORE_FEE = 0.15;

    const monthlyPriceOf = (plan: (typeof VOICE_PLANS)[number]) => {
      const price = Number(plan.priceDisplay.replace(/[^0-9.]/g, ""));
      if (plan.cadence.includes("year")) return price / 12;
      if (plan.cadence.includes("week")) return (price * 52) / 12;
      return price;
    };

    const cheapest = Math.min(...VOICE_PLANS.map(monthlyPriceOf));
    const netRevenue = cheapest * (1 - STORE_FEE);
    const ceilingCost = NARRATION_ALLOWANCE.voice.perMonth * AVG_CHARS * 0.5 * COST_PER_CREDIT;

    expect(ceilingCost).toBeLessThan(netRevenue);
  });
});
