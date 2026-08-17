import { describe, expect, it } from "vitest";

import { composeAction } from "./compose-action";
import { themeFor } from "@/features/stories/imagery";

/**
 * The bug these exist for: "today's action shows spend ten minutes on the part
 * you've been avoiding."
 *
 * That line is the last entry in the generic pool. It was appearing constantly
 * because a desire's category comes from `themeFor()` — which names an image
 * theme — while the actions were keyed by a different set of words. Five of
 * the eight image themes matched nothing, and the one `themeFor()` falls back
 * to matched nothing either.
 *
 * So the thing to assert isn't that any single action is good. It's that the
 * two vocabularies still agree, which is exactly what nobody checked.
 */

const GENERIC = "Spend ten minutes on the part you've been avoiding.";

/** Every value `themeFor()` can return. */
const IMAGE_THEMES = [
  "wealth",
  "love",
  "career",
  "calm",
  "health",
  "confidence",
  "travel",
  "home",
] as const;

describe("category vocabularies", () => {
  it("gives every image theme a specific action pool", () => {
    for (const category of IMAGE_THEMES) {
      const actions = Array.from({ length: 8 }, (_, i) =>
        composeAction({ title: "my own apartment", category }, new Date("2026-08-17"), i),
      );
      // If a theme falls through to the generic pool, every one of its
      // variants comes from there — which is what was happening.
      expect(new Set(actions).size).toBeGreaterThan(1);
      expect(actions.every((a) => a === GENERIC)).toBe(false);
    }
  });

  it("covers what themeFor actually produces for real desires", () => {
    const desires = [
      "I want to buy defender car",
      "I am making $10k a week",
      "Being the person my family relies on",
      "A calmer mind",
      "Attracting my person",
      "My own apartment",
      "Moving abroad",
      "The strongest I've been",
    ];

    for (const title of desires) {
      const category = themeFor(title);
      const action = composeAction({ title, category }, new Date("2026-08-17"));
      expect(action.length).toBeGreaterThan(20);
    }
  });

  it("still handles a category it has never seen", () => {
    const action = composeAction({ title: "something", category: "nonsense" }, new Date());
    expect(action.length).toBeGreaterThan(20);
  });

  it("handles no category at all", () => {
    const action = composeAction({ title: "something", category: null }, new Date());
    expect(action.length).toBeGreaterThan(20);
  });
});

describe("composeAction", () => {
  it("is stable for a given day and desire", () => {
    const seed = { title: "financial freedom", category: "wealth" };
    const day = new Date("2026-08-17");
    expect(composeAction(seed, day)).toBe(composeAction(seed, day));
  });

  it("changes from one day to the next", () => {
    const seed = { title: "financial freedom", category: "wealth" };
    expect(composeAction(seed, new Date("2026-08-17"))).not.toBe(
      composeAction(seed, new Date("2026-08-18")),
    );
  });

  it("gives two desires in one category different instructions", () => {
    const day = new Date("2026-08-17");
    const first = composeAction({ title: "a calmer mind", category: "calm" }, day);
    const second = composeAction({ title: "sleeping through the night", category: "calm" }, day);
    expect(first).not.toBe(second);
  });

  it("asks for something small enough to do on a bad day", () => {
    // What matters is how long the action TAKES, not whether it mentions a
    // period — "write down what you spent last month" is a ten-minute job that
    // happens to refer to a month. The first version of this test failed on
    // exactly that, which is a fair correction to have received from it.
    for (const category of IMAGE_THEMES) {
      for (let i = 0; i < 8; i += 1) {
        const action = composeAction({ title: "x", category }, new Date("2026-08-17"), i);
        expect(action).not.toMatch(
          /(every day for|for the next|over the next|each day this|spend a) (week|month|year)/i,
        );
      }
    }
  });
});
