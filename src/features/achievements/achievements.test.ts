import { describe, expect, it } from "vitest";

import { computeAchievements, streakMessage, type AchievementInput } from "./achievements";
import { longestRun } from "./use-achievements";

const NOTHING: AchievementInput = {
  practices: 0,
  practiceDays: 0,
  actionsCompleted: 0,
  milestonesCompleted: 0,
  goalsCompleted: 0,
  journalEntries: 0,
  boards: 0,
  longestStreak: 0,
};

describe("computeAchievements", () => {
  it("awards nothing to someone who has done nothing", () => {
    expect(computeAchievements(NOTHING).every((a) => !a.earned)).toBe(true);
  });

  it("awards the first practice as soon as there is one", () => {
    const earned = computeAchievements({ ...NOTHING, practices: 1 });
    expect(earned.find((a) => a.id === "first_practice")?.earned).toBe(true);
    expect(earned.find((a) => a.id === "thirty_practices")?.earned).toBe(false);
  });

  it("keeps progress between zero and one", () => {
    const over = computeAchievements({ ...NOTHING, actionsCompleted: 500, longestStreak: 900 });
    for (const achievement of over) {
      if (achievement.progress === null) continue;
      expect(achievement.progress).toBeGreaterThanOrEqual(0);
      expect(achievement.progress).toBeLessThanOrEqual(1);
    }
  });

  it("never uses grandiose language", () => {
    const all = computeAchievements({
      ...NOTHING,
      practices: 50,
      actionsCompleted: 50,
      longestStreak: 50,
    });
    for (const achievement of all) {
      expect(`${achievement.title} ${achievement.detail}`).not.toMatch(
        /legend|master|champion|hero|elite|ultimate|unstoppable|crush/i,
      );
    }
  });

  it("has no achievement for a streak beyond a week", () => {
    // Rewarding a long streak creates something to lose, and the fear of
    // losing it is what turns a practice into an obligation.
    const all = computeAchievements({ ...NOTHING, longestStreak: 365 });
    const streakOnes = all.filter((a) => a.detail.toLowerCase().includes("row"));
    expect(streakOnes).toHaveLength(1);
  });
});

describe("streakMessage", () => {
  it("welcomes someone back rather than scolding them", () => {
    const message = streakMessage(0, false);
    expect(message).toMatch(/welcome back/i);
    expect(message).not.toMatch(/lost|broke|failed|missed/i);
  });

  it("never implies a streak can be taken away", () => {
    for (const streak of [0, 1, 5, 40]) {
      for (const today of [true, false]) {
        expect(streakMessage(streak, today)).not.toMatch(/don't lose|keep it up|at risk/i);
      }
    }
  });
});

describe("longestRun", () => {
  it("counts consecutive days", () => {
    expect(longestRun(["2026-08-10", "2026-08-11", "2026-08-12"])).toBe(3);
  });

  it("resets on a gap but keeps the best run", () => {
    expect(longestRun(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-09"])).toBe(3);
  });

  it("ignores duplicate days", () => {
    expect(longestRun(["2026-08-10", "2026-08-10", "2026-08-11"])).toBe(2);
  });

  it("handles month boundaries", () => {
    expect(longestRun(["2026-07-31", "2026-08-01"])).toBe(2);
  });

  it("is zero with no history", () => {
    expect(longestRun([])).toBe(0);
  });
});
