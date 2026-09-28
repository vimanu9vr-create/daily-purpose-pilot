import { describe, expect, it } from "vitest";

import { matchCategory } from "./match-category";

/**
 * The reported bug: selecting career, confidence, love and money produced an
 * app that was entirely about money, because money happened to be tapped
 * first and everything downstream read focusAreas[0].
 */
describe("matchCategory", () => {
  const FOUR = ["money", "career", "confidence", "relationships"];

  it("picks confidence for a sentence about confidence, not the first tap", () => {
    expect(matchCategory(FOUR, "I want to feel confident presenting at work")).toBe("confidence");
  });

  it("picks relationships for a sentence about love", () => {
    expect(matchCategory(FOUR, "I want a relationship where I feel chosen")).toBe("relationships");
  });

  it("still picks money when the sentence really is about money", () => {
    expect(matchCategory(FOUR, "I want to clear my debt and stop worrying about rent")).toBe(
      "money",
    );
  });

  it("prefers the more specific phrase when two could match", () => {
    // "dream job" is more specific than "job", which career also matches.
    expect(matchCategory(["career", "dream-job"], "I want the dream job offer")).toBe("dream-job");
  });

  /**
   * It narrows an existing choice and never invents one. Filing someone's
   * desire under a category they explicitly did not pick would be worse than
   * the bug it replaces.
   */
  it("never returns an area that wasn't selected", () => {
    const picked = matchCategory(["money"], "I want to feel healthy and strong and confident");
    expect(picked).toBe("money");
  });

  it("falls back to the first tap when nothing matches", () => {
    expect(matchCategory(FOUR, "asdf qwerty")).toBe("money");
    expect(matchCategory(FOUR, "")).toBe("money");
  });

  it("handles a single selection and an empty one", () => {
    expect(matchCategory(["health"], "anything at all")).toBe("health");
    expect(matchCategory([], "anything at all")).toBeUndefined();
  });

  it("is not confused by punctuation or capitals", () => {
    expect(matchCategory(FOUR, "I WANT CONFIDENCE!!! — badly.")).toBe("confidence");
  });

  it("does not match a word inside another word", () => {
    // "income" contains "come" but not " money "; a naive substring match on
    // short terms would fire on half the sentences in English.
    expect(matchCategory(["health", "peace"], "I want a calm morning")).toBe("peace");
  });
});
