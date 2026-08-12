import { describe, expect, it } from "vitest";

import { buildPracticePlan, stretchToBudget, type PracticeStyle } from "./practice-plan";

const ALL: PracticeStyle[] = [
  "writing",
  "visualization",
  "affirmations",
  "meditation",
  "gratitude",
  "action",
];

describe("buildPracticePlan", () => {
  it("always includes the intention and the action", () => {
    for (const minutes of [2, 5, 10, 15]) {
      for (const styles of [[], ["writing"] as PracticeStyle[], ALL]) {
        const ids = buildPracticePlan(minutes, styles).steps.map((step) => step.id);
        expect(ids).toContain("intention");
        expect(ids).toContain("action");
      }
    }
  });

  it("ends on the action, never in the middle", () => {
    const steps = buildPracticePlan(15, ALL).steps;
    expect(steps.at(-1)?.id).toBe("action");
  });

  it("respects the time budget", () => {
    for (const minutes of [2, 5, 10, 15]) {
      const plan = buildPracticePlan(minutes, ALL);
      expect(plan.totalSeconds).toBeLessThanOrEqual(minutes * 60);
    }
  });

  it("gives a two-minute session fewer steps than a fifteen-minute one", () => {
    const short = buildPracticePlan(2, ALL).steps.length;
    const long = buildPracticePlan(15, ALL).steps.length;
    expect(short).toBeLessThan(long);
  });

  it("only offers steps matching the chosen styles", () => {
    const ids = buildPracticePlan(15, ["writing"]).steps.map((step) => step.id);
    expect(ids).toContain("journal");
    expect(ids).not.toContain("breathe");
    expect(ids).not.toContain("visualize");
  });

  it("treats no preference as every preference, not none", () => {
    const none = buildPracticePlan(15, []).steps.length;
    const all = buildPracticePlan(15, ALL).steps.length;
    expect(none).toBe(all);
  });
});

describe("stretchToBudget", () => {
  it("uses the time the user actually chose", () => {
    const plan = buildPracticePlan(15, ALL);
    const stretched = stretchToBudget(plan, 15);
    // Within one step's rounding of the full budget.
    expect(stretched.totalSeconds).toBeGreaterThan(15 * 60 - 60);
    expect(stretched.totalSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it("leaves a session alone when there's nothing spare", () => {
    const plan = buildPracticePlan(2, ALL);
    expect(stretchToBudget(plan, 2).totalSeconds).toBeLessThanOrEqual(2 * 60);
  });
});
