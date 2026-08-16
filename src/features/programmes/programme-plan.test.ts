import { describe, expect, it } from "vitest";

import {
  buildProgramme,
  programmeMessage,
  programmeProgress,
  programmeTitle,
} from "./programme-plan";

const DREAM = "my app has 1 million active users";

describe("buildProgramme", () => {
  it("makes exactly the number of days asked for", () => {
    expect(buildProgramme(DREAM, 7)).toHaveLength(7);
    expect(buildProgramme(DREAM, 21)).toHaveLength(21);
  });

  it("numbers days from one", () => {
    const days = buildProgramme(DREAM, 7);
    expect(days.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("gives a seven day programme seven different themes", () => {
    const themes = buildProgramme(DREAM, 7).map((day) => day.theme);
    expect(new Set(themes).size).toBe(7);
  });

  it("never repeats a day's wording inside a 21 day programme", () => {
    // The arc runs three times, so days 1, 8 and 15 share a stage. They must
    // not share their text, or the second and third weeks are filler.
    const days = buildProgramme(DREAM, 21);
    const written = days.map((day) => `${day.intention}\n${day.lines.join("\n")}`);
    expect(new Set(written).size).toBe(21);
  });

  it("uses the dream in the person's own words", () => {
    const days = buildProgramme("earning 20000cr", 7);
    const all = days.flatMap((day) => day.lines).join(" ");
    expect(all).toMatch(/20000cr/);
  });

  it("gives every day something to say", () => {
    for (const day of buildProgramme(DREAM, 21)) {
      expect(day.lines.length).toBeGreaterThanOrEqual(3);
      expect(day.intention.length).toBeGreaterThan(10);
      for (const line of day.lines) expect(line.length).toBeGreaterThan(15);
    }
  });

  it("never predicts what the world will do", () => {
    // The same line the affirmation writer holds: identity, not prophecy.
    const all = buildProgramme(DREAM, 21)
      .flatMap((day) => [day.intention, ...day.lines])
      .join(" ");
    expect(all).not.toMatch(
      /will happen|is on its way|the universe|flowing to me|manifest(s|ing)? into/i,
    );
    expect(all).not.toMatch(/guaranteed|destined|meant to be/i);
  });

  it("has no deadline language anywhere", () => {
    const all = buildProgramme(DREAM, 21)
      .flatMap((day) => [day.theme, day.intention, ...day.lines])
      .join(" ");
    expect(all).not.toMatch(/don't break|streak|miss(ed)? a day|catch up|behind/i);
  });

  it("copes with a dream it can't parse", () => {
    const days = buildProgramme("!!!", 7);
    expect(days).toHaveLength(7);
    expect(days[0]!.lines.every((line) => line.length > 15)).toBe(true);
  });

  it("is deterministic, so reopening doesn't reshuffle the programme", () => {
    expect(buildProgramme(DREAM, 21)).toEqual(buildProgramme(DREAM, 21));
  });
});

describe("programmeProgress", () => {
  it("points at day one before anything is done", () => {
    expect(programmeProgress(0, 7)).toEqual({
      done: 0,
      current: 1,
      percent: 0,
      isFinished: false,
    });
  });

  it("points at the next day, whatever the calendar says", () => {
    // A three week gap makes no difference: three done means day four next.
    expect(programmeProgress(3, 21).current).toBe(4);
  });

  it("does not run past the end", () => {
    expect(programmeProgress(21, 21)).toEqual({
      done: 21,
      current: 21,
      percent: 100,
      isFinished: true,
    });
    expect(programmeProgress(99, 7).percent).toBe(100);
  });

  it("clamps nonsense rather than reporting it", () => {
    expect(programmeProgress(-4, 7).done).toBe(0);
  });
});

describe("programmeMessage", () => {
  it("never implies anything was lost", () => {
    for (const length of [7, 21] as const) {
      for (let done = 0; done <= length; done += 1) {
        const message = programmeMessage(done, length);
        expect(message).not.toMatch(/miss|lost|broke|behind|failed|restart|again from/i);
      }
    }
  });

  it("does not congratulate", () => {
    // Same rule as the weekly summary: report, don't cheer.
    for (let done = 0; done <= 21; done += 1) {
      expect(programmeMessage(done, 21)).not.toMatch(/amazing|great|well done|keep it up|proud/i);
    }
  });

  it("says where they are", () => {
    expect(programmeMessage(5, 21)).toContain("5");
    expect(programmeMessage(21, 21)).toMatch(/all 21/i);
  });
});

describe("programmeTitle", () => {
  it("names the length and the dream", () => {
    expect(programmeTitle("financial freedom", 21)).toBe("21 days — financial freedom");
  });
});
