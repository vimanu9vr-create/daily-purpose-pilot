import { describe, expect, it } from "vitest";

import { desireNounPhraseOr, desirePhrase, withArticle } from "./desire-phrase";

describe("desirePhrase", () => {
  it("leaves tidy noun phrases alone", () => {
    expect(desirePhrase("A calmer mind")).toBe("a calmer mind");
    expect(desirePhrase("My own apartment")).toBe("my own apartment");
    expect(desirePhrase("money")).toBe("money");
  });

  it("strips the first-person framing people actually type", () => {
    // The exact input that produced "working toward my aim is to earn 20000cr".
    expect(desirePhrase("my aim is to earn 20000cr")).toBe("earning 20000cr");
    expect(desirePhrase("My goal is financial freedom")).toBe("financial freedom");
    expect(desirePhrase("to travel more")).toBe("travelling more");
  });

  it("spells gerunds correctly", () => {
    expect(desirePhrase("live abroad")).toBe("living abroad");
    expect(desirePhrase("get fit")).toBe("getting fit");
    expect(desirePhrase("win the contract")).toBe("winning the contract");
    expect(desirePhrase("build a business")).toBe("building a business");
  });

  /**
   * Things you HAVE come back as nouns, not gerunds.
   *
   * "I want to buy defender car" used to return "buying defender car", which
   * every caller then spliced into a noun slot: "buying defender car is yours
   * now", "you haven't thought about wanting buying defender car in weeks".
   *
   * This test previously asserted `desirePhrase("I want to buy a house")` was
   * "buying a house" — correct for the template that existed then ("before you
   * started working toward…") and wrong for every template that exists now.
   * Changed deliberately, not loosened.
   */
  it("returns the object for things you acquire, not the act of acquiring", () => {
    expect(desirePhrase("I want to buy defender car")).toBe("your defender car");
    expect(desirePhrase("I want to buy a house")).toBe("a house");
    expect(desirePhrase("own my own home")).toBe("my own home");
    expect(desirePhrase("afford a house")).toBe("a house");
  });

  it("tells an acquisition from a state, for verbs that can be either", () => {
    // "get" is the awkward one: the object of "get a new job" is a thing, and
    // the object of "get fit" is not. The determiner is what settles it.
    expect(desirePhrase("get a new job")).toBe("a new job");
    expect(desirePhrase("get fit")).toBe("getting fit");
  });

  it("gives up rather than guessing on a whole sentence", () => {
    expect(
      desirePhrase("I have been trying for years to finally feel at home in my own body"),
    ).toBeNull();
    expect(desirePhrase("")).toBeNull();
  });
});

describe("withArticle", () => {
  /**
   * The bug this was written for. The practice screen read "I am becoming the
   * kind of person for whom dream job offer is ordinary" for months.
   */
  it("adds the article a bare countable noun phrase needs", () => {
    expect(withArticle("dream job offer")).toBe("a dream job offer");
    expect(withArticle("calmer mind")).toBe("a calmer mind");
    expect(withArticle("new apartment")).toBe("a new apartment");
  });

  it("uses 'an' before a vowel sound, and only a real one", () => {
    expect(withArticle("easier morning")).toBe("an easier morning");
    expect(withArticle("hour to myself")).toBe("an hour to myself");
    // Spelled with a vowel, pronounced with a consonant.
    expect(withArticle("university place")).toBe("a university place");
    expect(withArticle("european summer")).toBe("a european summer");
  });

  it("leaves anything already determined alone", () => {
    expect(withArticle("a calmer mind")).toBe("a calmer mind");
    expect(withArticle("my own apartment")).toBe("my own apartment");
    expect(withArticle("your defender car")).toBe("your defender car");
    expect(withArticle("more time with my kids")).toBe("more time with my kids");
  });

  it("leaves gerunds alone, because activities take no article", () => {
    expect(withArticle("getting over him")).toBe("getting over him");
    expect(withArticle("earning 20000cr")).toBe("earning 20000cr");
    expect(withArticle("loving my own company")).toBe("loving my own company");
  });

  it("leaves mass nouns alone, judging by the head noun not the first word", () => {
    // "a financial freedom" is exactly as broken as the missing article.
    expect(withArticle("financial freedom")).toBe("financial freedom");
    expect(withArticle("unshakeable confidence")).toBe("unshakeable confidence");
    expect(withArticle("money")).toBe("money");
    expect(withArticle("inner peace")).toBe("inner peace");
  });

  it("leaves plurals alone, but not words that merely end in s", () => {
    expect(withArticle("$10k months")).toBe("$10k months");
    expect(withArticle("paying clients")).toBe("paying clients");
    expect(withArticle("steady business")).toBe("a steady business");
  });
});

/**
 * Where this is knowingly imperfect.
 *
 * An -ing word is treated as a gerund without checking whether it is really an
 * adjective, so "thriving business" keeps no article. That is a deliberate
 * choice rather than an oversight: telling "loving my own company" (a gerund,
 * article would be nonsense) from "thriving business" (an adjective, article is
 * wanted) needs the part of speech, which we do not have. Getting it wrong in
 * this direction reads slightly bare; getting it wrong in the other direction
 * produces "a loving my own company", which is the sort of sentence that makes
 * somebody close the app. So the tie goes to omission, as it does everywhere
 * else in this file.
 */
describe("withArticle, where it knowingly gives up", () => {
  it("skips the article for an -ing adjective, rather than risk the gerund case", () => {
    expect(withArticle("thriving business")).toBe("thriving business");
    expect(withArticle("loving my own company")).toBe("loving my own company");
  });
});

describe("desireNounPhraseOr", () => {
  it("produces a phrase that reads correctly in the practice template", () => {
    const say = (title: string) =>
      `I am becoming the kind of person for whom ${desireNounPhraseOr(title)} is ordinary.`;

    expect(say("Dream job offer")).toBe(
      "I am becoming the kind of person for whom a dream job offer is ordinary.",
    );
    expect(say("Financial freedom")).toBe(
      "I am becoming the kind of person for whom financial freedom is ordinary.",
    );
    expect(say("My own apartment")).toBe(
      "I am becoming the kind of person for whom my own apartment is ordinary.",
    );
  });

  /**
   * The fallback is already a complete noun phrase. Putting an article in front
   * of it would reintroduce the bug in a different sentence.
   */
  it("returns the fallback untouched when the desire can't be spliced", () => {
    const unspliceable = "I have been trying for years to finally feel at home in my own body";
    expect(desireNounPhraseOr(unspliceable)).toBe("what you're working toward");
  });
});
