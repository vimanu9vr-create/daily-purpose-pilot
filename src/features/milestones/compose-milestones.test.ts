import { describe, expect, it } from "vitest";

import { composeMilestones, computeProgress } from "./compose-milestones";

describe("composeMilestones", () => {
  it("gives five steps for a known category", () => {
    expect(composeMilestones({ title: "Financial freedom", category: "Wealth" })).toHaveLength(5);
  });

  it("falls back rather than returning nothing for an unknown category", () => {
    const steps = composeMilestones({ title: "Something odd", category: "Astrology" });
    expect(steps.length).toBeGreaterThan(0);
  });

  it("returns a fresh array each time, so callers can't corrupt the templates", () => {
    const first = composeMilestones({ title: "A", category: "Wealth" });
    first.push("mutated");
    expect(composeMilestones({ title: "B", category: "Wealth" })).toHaveLength(5);
  });
});

describe("computeProgress", () => {
  it("says nothing when there is nothing to measure", () => {
    expect(
      computeProgress({
        milestonesTotal: 0,
        milestonesDone: 0,
        actionsTotal: 0,
        actionsDone: 0,
      }),
    ).toBeNull();
  });

  it("is zero when nothing has been done", () => {
    expect(
      computeProgress({
        milestonesTotal: 5,
        milestonesDone: 0,
        actionsTotal: 10,
        actionsDone: 0,
      }),
    ).toBe(0);
  });

  it("is a hundred only when everything is done", () => {
    expect(
      computeProgress({
        milestonesTotal: 5,
        milestonesDone: 5,
        actionsTotal: 10,
        actionsDone: 10,
      }),
    ).toBe(100);
  });

  it("won't let daily ticks alone claim the goal is nearly finished", () => {
    // Every action done, no milestones — the plan hasn't moved.
    const progress = computeProgress({
      milestonesTotal: 5,
      milestonesDone: 0,
      actionsTotal: 30,
      actionsDone: 30,
    });
    expect(progress).toBeLessThanOrEqual(34);
  });

  it("never exceeds a hundred or drops below zero", () => {
    for (const done of [0, 1, 3, 5]) {
      const progress = computeProgress({
        milestonesTotal: 5,
        milestonesDone: done,
        actionsTotal: 4,
        actionsDone: done,
      })!;
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    }
  });
});
