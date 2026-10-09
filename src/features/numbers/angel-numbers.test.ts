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
  /* These build dates with the LOCAL constructor — new Date(y, m, d, h) — and
     not an ISO "…Z" string, which is what they used to do.

     numberForToday keys off the local calendar date, deliberately: the number
     should turn over at the reader's own midnight, not at midnight UTC. A test
     written as "2026-08-16T22:00:00Z" therefore only means "the evening of the
     16th" in Britain and westward. In IST that instant is already 03:30 on the
     17th, so the two calls landed on different days and the suite failed — on
     a developer machine in India, while passing in CI, which runs UTC.

     Note the month is 0-indexed: 7 is August. */
  it("is stable within a day", () => {
    const morning = new Date(2026, 7, 16, 7, 0, 0);
    const evening = new Date(2026, 7, 16, 22, 0, 0);
    expect(numberForToday(morning).number).toBe(numberForToday(evening).number);
  });

  it("changes from one day to the next", () => {
    const today = numberForToday(new Date(2026, 7, 16, 12, 0, 0));
    const tomorrow = numberForToday(new Date(2026, 7, 17, 12, 0, 0));
    expect(today.number).not.toBe(tomorrow.number);
  });

  // The regression the two above cannot catch on their own: midday is far from
  // any boundary, so they would still pass if the function went back to using
  // UTC dates. This pins the actual contract — one number per local day,
  // whatever the timezone — by walking the full span of a single local day.
  it("gives one number for the whole of a local day, edge to edge", () => {
    const expected = numberForToday(new Date(2026, 7, 16, 12, 0, 0)).number;
    for (const hour of [0, 1, 6, 12, 18, 23]) {
      const at = new Date(2026, 7, 16, hour, 30, 0);
      expect(numberForToday(at).number).toBe(expected);
    }
  });
});
