import { describe, expect, it } from "vitest";

import { composeMoment, composeMomentAt, momentTemplateCount } from "./compose-moment";

/**
 * These tests exist because of a complaint, not a theory.
 *
 * The feed generated 315 stories from six templates, so "More for you" and
 * "Trending for you" showed the same handful of scenes on repeat — reported as
 * "it shows you sit at your desk for everything, every track". Nothing in the
 * test suite noticed, because every test checked that a single story was
 * well-formed. None checked that two stories were different from each other.
 *
 * That's the gap these close: variety is a property of the set, so it has to be
 * asserted over a set.
 */

const SEED = {
  title: "launching my app",
  why: "I want to build something people use",
  feeling: "calm and capable",
  obstacles: "I keep starting over",
};

const OTHER_SEED = { title: "financial freedom" };

describe("composeMomentAt", () => {
  it("gives a feed of twenty stories twenty different openings", () => {
    const openings = Array.from(
      { length: 20 },
      (_, i) => composeMomentAt(SEED, i).body.split("\n\n")[0],
    );
    expect(new Set(openings).size).toBe(20);
  });

  it("does not repeat a whole story until both lists have wrapped", () => {
    const bodies = Array.from({ length: 40 }, (_, i) => composeMomentAt(SEED, i).body);
    expect(new Set(bodies).size).toBe(40);
  });

  it("puts two different desires in different places at the same offset", () => {
    // Without this, someone with four desires reads the same scene four times
    // in one feed — the same bug, one level up.
    const mine = composeMomentAt(SEED, 0).body.split("\n\n")[0];
    const theirs = composeMomentAt(OTHER_SEED, 0).body.split("\n\n")[0];
    expect(mine).not.toBe(theirs);
  });

  it("never puts the scene at a desk", () => {
    for (let i = 0; i < 40; i += 1) {
      expect(composeMomentAt(SEED, i).body).not.toMatch(/desk|laptop|office|inbox/i);
    }
  });

  it("is stable for a given offset, so a re-render doesn't reshuffle it", () => {
    expect(composeMomentAt(SEED, 7).body).toBe(composeMomentAt(SEED, 7).body);
  });

  it("carries the feeling they wrote down through the whole feed", () => {
    // Asserted across the set rather than on one story: the first version of
    // this test checked a single offset and failed, which is how it turned up
    // that one of the six templates quietly ignored the feeling entirely.
    const carried = Array.from({ length: 12 }, (_, i) => composeMomentAt(SEED, i).body).filter(
      (body) => /calm and capable/i.test(body),
    );
    expect(carried.length).toBe(12);
  });

  it("uses the obstacle they named, where the shape calls for it", () => {
    const bodies = Array.from({ length: 12 }, (_, i) => composeMomentAt(SEED, i).body);
    expect(bodies.some((body) => /keep starting over/i.test(body))).toBe(true);
  });

  it("opens every story on a place, never on an argument", () => {
    // Two of the six shapes used to open by naming who you're picturing, with
    // the place on the second line. That made their first line identical every
    // sixth story — and the first line is the preview in the feed, so those
    // were the ones that looked repeated even when the story wasn't.
    for (let i = 0; i < 20; i += 1) {
      const first = composeMomentAt(SEED, i).body.split("\n\n")[0]!;
      expect(first).toMatch(/^(you're|you've|it's|you wake|you wrote|someone)/i);
    }
  });

  /**
   * The two that matter most, and the reason this file grew.
   *
   * Reported as "it shows you're on the bus, you're walking back, you're in
   * the corridor outside" — all opening lines from here — and, separately,
   * that the stories didn't feel real. Both came from the same two habits, and
   * neither was caught by any test, because every existing test asked whether
   * the stories DIFFERED and none asked what they were actually like.
   */
  it("never ends by giving the listener a task", () => {
    // Every template used to close on an instruction. Across the stories that
    // produced, 334 of 359 ended that way. Something you listen to with your
    // eyes shut should not finish by handing you a job.
    for (let i = 0; i < 40; i += 1) {
      const paragraphs = composeMomentAt(SEED, i).body.split("\n\n");
      const last = paragraphs[paragraphs.length - 1]!;
      expect(last).not.toMatch(
        /\b(then (come back|go)|keep (walking|going)|do (today's|the next|that)|pick the smallest|go add|sit with that)\b/i,
      );
    }
  });

  it("is set in a life where the thing is already true", () => {
    // The old frame put you somewhere quiet to think ABOUT something you were
    // still chasing. That is what made them feel like planning rather than
    // manifestation, and it is what "doesn't feel real" meant.
    for (let i = 0; i < 40; i += 1) {
      const body = composeMomentAt(SEED, i).body;
      expect(body).not.toMatch(/\b(chasing|working toward|still ahead of you and progress)\b/i);
    }
  });

  it("never promises the world will deliver it", () => {
    // The line that separates a visualisation from a lie. Imagining a scene is
    // the exercise; claiming it is being arranged for you is not.
    for (let i = 0; i < 40; i += 1) {
      expect(composeMomentAt(SEED, i).body).not.toMatch(
        /\b(on its way|the universe|manifest(ing)? into|meant to be|guaranteed|will come to you)\b/i,
      );
    }
  });
});

describe("composeMoment", () => {
  it("returns one of the templates", () => {
    const moment = composeMoment(SEED, new Date("2026-08-13"));
    expect(moment.title).toBeTruthy();
    expect(moment.body.split("\n\n").length).toBeGreaterThanOrEqual(4);
  });

  it("changes from one day to the next", () => {
    const today = composeMoment(SEED, new Date("2026-08-13")).body;
    const tomorrow = composeMoment(SEED, new Date("2026-08-14")).body;
    expect(today).not.toBe(tomorrow);
  });

  it("has more than a handful of templates to draw on", () => {
    expect(momentTemplateCount()).toBeGreaterThanOrEqual(6);
  });
});
