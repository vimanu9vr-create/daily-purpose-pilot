import { describe, expect, it } from "vitest";

import { desirePhrase } from "./desire-phrase";

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
