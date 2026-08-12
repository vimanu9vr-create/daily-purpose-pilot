import { describe, expect, it } from "vitest";

import { startOfWeek, summariseWeek, type WeeklyInput } from "./weekly-summary";

const EMPTY: WeeklyInput = {
  practiceDays: [],
  practiceSeconds: 0,
  journalEntries: 0,
  actionsCompleted: 0,
  actionsOffered: 0,
  milestonesCompleted: 0,
  focusAreas: [],
};

describe("summariseWeek", () => {
  it("never flatters an empty week", () => {
    const summary = summariseWeek(EMPTY);
    expect(summary.practices).toBe(0);
    expect(summary.reflection).not.toMatch(/amazing|great|well done|fantastic/i);
    // And says nothing prescriptive, because nagging is what gets apps deleted.
    expect(summary.suggestion).toBeNull();
  });

  it("counts what actually happened", () => {
    const summary = summariseWeek({
      ...EMPTY,
      practiceDays: ["2026-08-10", "2026-08-11", "2026-08-12"],
      practiceSeconds: 900,
      journalEntries: 2,
      actionsCompleted: 4,
      actionsOffered: 6,
      milestonesCompleted: 1,
    });

    expect(summary.practices).toBe(3);
    expect(summary.minutes).toBe(15);
    expect(summary.journalEntries).toBe(2);
    expect(summary.actionsCompleted).toBe(4);
  });

  it("uses singular and plural correctly", () => {
    const one = summariseWeek({ ...EMPTY, practiceDays: ["2026-08-12"], practiceSeconds: 60 });
    expect(one.reflection).toContain("1 session");
    expect(one.reflection).not.toContain("1 sessions");
  });

  it("notices sessions without follow-through", () => {
    const summary = summariseWeek({
      ...EMPTY,
      practiceDays: ["a", "b", "c"],
      practiceSeconds: 600,
      actionsOffered: 5,
      actionsCompleted: 0,
    });
    expect(summary.suggestion).toMatch(/action/i);
  });

  it("credits doing over practising when that's what happened", () => {
    const summary = summariseWeek({
      ...EMPTY,
      practiceDays: ["a"],
      practiceSeconds: 120,
      actionsOffered: 7,
      actionsCompleted: 5,
    });
    expect(summary.reflection).toMatch(/doing/i);
  });

  it("never uses judgemental language about a quiet week", () => {
    const summary = summariseWeek({ ...EMPTY, practiceDays: ["a"], practiceSeconds: 60 });
    expect(summary.reflection).not.toMatch(/only|just|failed|missed|should/i);
  });
});

describe("startOfWeek", () => {
  it("starts weeks on Monday", () => {
    // 2026-08-12 is a Wednesday.
    const monday = startOfWeek(new Date(2026, 7, 12));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(10);
  });

  it("treats Sunday as the end of its week, not the start of the next", () => {
    // 2026-08-16 is a Sunday; its week began Monday the 10th.
    const monday = startOfWeek(new Date(2026, 7, 16));
    expect(monday.getDate()).toBe(10);
  });

  it("starts at midnight", () => {
    const monday = startOfWeek(new Date(2026, 7, 12, 15, 42));
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
  });
});
