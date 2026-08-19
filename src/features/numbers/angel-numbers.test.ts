import { describe, expect, it } from "vitest";

import { ANGEL_NUMBERS, numberForToday, reflectionFor } from "./angel-numbers";

/**
 * The rule these enforce is the one the whole feature stands on: a number may
 * be read as meaning something, but it is never allowed to predict anything.
 *
 * The personalised question used to be a fixed sentence with the dream slotted
 * into a gap, and these tests checked the slotting worked. It doesn't exist any
 * more — the question is written by the model — so what is left to test here is
 * the part that is fixed on purpose: the meanings themselves.
 */
describe("angel numbers", () => {
  it("never asserts that a number causes or foretells an outcome", () => {
    for (const entry of ANGEL_NUMBERS) {
      const text = `${entry.digit} ${entry.meaning} ${entry.prompt}`;
      expect(text).not.toMatch(/will happen|means you will|is a sign that you will|guarantees/i);
      expect(text).not.toMatch(/the universe is|destiny|fated|meant to be/i);
    }
  });

  it("attributes the meaning rather than stating it as fact", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(entry.meaning).toMatch(
        /read as|associated with|traditionally|tradition|taken as|taken to/i,
      );
    }
  });

  it("asks a question rather than giving an instruction", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(entry.prompt).toContain("?");
    }
  });

  /**
   * Each number has to say what THAT number means.
   *
   * "Angel number represent what the number represent" — the meanings were
   * one-liners that could have been shuffled between numbers without anyone
   * noticing, which is the same failure as a template. Every entry now
   * explains the digit itself before explaining the repetition.
   */
  it("explains what the digit itself stands for", () => {
    for (const entry of ANGEL_NUMBERS) {
      expect(entry.digit.length).toBeGreaterThan(40);
      expect(entry.meaning.length).toBeGreaterThan(80);
    }
  });

  it("gives every number a distinct meaning", () => {
    const digits = ANGEL_NUMBERS.map((entry) => entry.digit);
    expect(new Set(digits).size).toBe(ANGEL_NUMBERS.length);
    const meanings = ANGEL_NUMBERS.map((entry) => entry.meaning);
    expect(new Set(meanings).size).toBe(ANGEL_NUMBERS.length);
  });

  it("covers 666 and corrects the usual misreading", () => {
    // The most-seen and most-feared of the set. Leaving it out was a gap;
    // including it without the correction would have been worse.
    const six = ANGEL_NUMBERS.find((entry) => entry.number === "666");
    expect(six).toBeDefined();
    expect(six!.meaning).toMatch(/Revelation|misread/i);
  });
});

describe("reflectionFor", () => {
  it("falls back to the general question when there's no dream yet", async () => {
    for (const entry of ANGEL_NUMBERS.slice(0, 3)) {
      await expect(reflectionFor(entry, null)).resolves.toBe(entry.prompt);
      await expect(reflectionFor(entry, "   ")).resolves.toBe(entry.prompt);
      await expect(reflectionFor(entry, undefined)).resolves.toBe(entry.prompt);
    }
  });

  it("falls back rather than producing a mangled sentence", async () => {
    // The desire parser returns null when it can't shape the text. Splicing it
    // in anyway is exactly how "working toward my aim is to earn 20000cr"
    // reached a user, so an unparseable dream takes the general question.
    const entry = ANGEL_NUMBERS[0]!;
    await expect(reflectionFor(entry, "!!!")).resolves.toBe(entry.prompt);
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
