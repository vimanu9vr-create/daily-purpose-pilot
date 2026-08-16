import { describe, expect, it } from "vitest";

import { ANGEL_NUMBERS, numberForToday, reflectionFor } from "./angel-numbers";

/**
 * The rule these enforce is the one the whole feature stands on: a number may
 * be read as meaning something, but it is never allowed to predict anything.
 */
describe("angel numbers", () => {
  it("never asserts that a number causes or foretells an outcome", () => {
    for (const entry of ANGEL_NUMBERS) {
      const text = `${entry.meaning} ${entry.prompt} ${entry.personal("earning 20000cr")}`;
      expect(text).not.toMatch(/will happen|means you will|is a sign that you will|guarantees/i);
      expect(text).not.toMatch(/the universe is|destiny|fated|meant to be/i);
    }
  });

  it("attributes the meaning rather than stating it as fact", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(entry.meaning).toMatch(/read as|associated with|traditionally|people read/i);
    }
  });

  it("asks a question rather than giving an instruction", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(entry.prompt).toContain("?");
      expect(entry.personal("financial freedom")).toContain("?");
    }
  });
});

describe("reflectionFor", () => {
  it("names the dream when there is one", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(reflectionFor(entry, "financial freedom")).toMatch(/financial freedom/);
    }
  });

  it("falls back to the general question when there's no dream yet", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(reflectionFor(entry, null)).toBe(entry.prompt);
      expect(reflectionFor(entry, "   ")).toBe(entry.prompt);
      expect(reflectionFor(entry, undefined)).toBe(entry.prompt);
    }
  });

  it("falls back rather than producing a mangled sentence", () => {
    // The desire parser returns null when it can't shape the text. Splicing it
    // in anyway is exactly how "working toward my aim is to earn 20000cr"
    // reached a user, so an unparseable dream takes the generic question.
    const entry = ANGEL_NUMBERS[0]!;
    expect(reflectionFor(entry, "!!!")).toBe(entry.prompt);
  });

  it("reads as one sentence, not a template with a slot in it", () => {
    const text = reflectionFor(ANGEL_NUMBERS[7]!, "my own apartment");
    expect(text).not.toMatch(/\bmy aim is to\b|\bi want to want\b|\s{2,}/);
    expect(text).toMatch(/^[A-Z]/);
  });

  it("differs from the generic question, or it wasn't worth doing", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(reflectionFor(entry, "a calmer mind")).not.toBe(entry.prompt);
    }
  });
});

describe("numberForToday", () => {
  it("is stable within a day", () => {
    const morning = new Date("2026-08-16T07:00:00Z");
    const evening = new Date("2026-08-16T22:00:00Z");
    expect(numberForToday(morning).number).toBe(numberForToday(evening).number);
  });

  it("changes from one day to the next", () => {
    const today = numberForToday(new Date("2026-08-16T12:00:00Z"));
    const tomorrow = numberForToday(new Date("2026-08-17T12:00:00Z"));
    expect(today.number).not.toBe(tomorrow.number);
  });
});
