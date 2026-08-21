import { describe, expect, it } from "vitest";

import { displayHook, hookFrom, interleaveByDesire } from "./use-stories";

/**
 * The bug these are here for.
 *
 * "I typed 'I want to buy defender car' and I still don't see it." Two separate
 * mistakes of mine stacked to produce that, and both were invisible from the
 * code — you had to look at the database to see them.
 *
 * One: stories were hidden once `expires_at` passed, but only the two newest
 * dreams were ever written for again. So the third dream down and everything
 * below it expired once and stayed blank forever. Seven of nine dreams.
 *
 * Two: the feed is now ordered newest-first with no expiry filter, which on its
 * own would show sixteen cards from a single dream and hide the rest below the
 * limit — the same disappearance by a different route.
 *
 * `interleaveByDesire` is the answer to the second, and it's the piece worth
 * testing directly: it's pure, and it's the thing that guarantees a dream you
 * typed appears on the screen.
 */

type Row = { id: string; desire_id: string | null };

const rows = (...pairs: [string, string | null][]): Row[] =>
  pairs.map(([id, desire_id]) => ({ id, desire_id }));

describe("interleaveByDesire", () => {
  it("puts one story from every dream before a second from any", () => {
    const out = interleaveByDesire(
      rows(["a1", "a"], ["a2", "a"], ["a3", "a"], ["b1", "b"], ["c1", "c"]),
    );
    expect(out.slice(0, 3).map((r) => r.id)).toEqual(["a1", "b1", "c1"]);
  });

  it("shows every dream within the first row of the feed", () => {
    // Nine dreams, the newest with far more stories than the rest — the exact
    // shape that hid "I want to buy defender car" behind a limit.
    const many: Row[] = [];
    for (let i = 0; i < 40; i += 1) many.push({ id: `new${i}`, desire_id: "newest" });
    for (const d of ["b", "c", "d", "e", "f", "g", "h", "i"]) {
      many.push({ id: `${d}1`, desire_id: d });
    }

    const firstRow = interleaveByDesire(many).slice(0, 9);
    expect(new Set(firstRow.map((r) => r.desire_id)).size).toBe(9);
  });

  it("keeps every story, losing none", () => {
    const input = rows(["a1", "a"], ["a2", "a"], ["b1", "b"], ["x", null]);
    const out = interleaveByDesire(input);
    expect(out.length).toBe(input.length);
    expect(new Set(out.map((r) => r.id))).toEqual(new Set(input.map((r) => r.id)));
  });

  it("keeps each dream's own stories in the order they came in", () => {
    const out = interleaveByDesire(rows(["a1", "a"], ["b1", "b"], ["a2", "a"], ["a3", "a"]));
    expect(out.filter((r) => r.desire_id === "a").map((r) => r.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("handles an empty feed", () => {
    expect(interleaveByDesire([])).toEqual([]);
  });
});

describe("hookFrom", () => {
  /**
   * The card must never show the user their own typed dream back.
   *
   * Eleven of twenty-nine cards were doing exactly that, because the old
   * version fell back to the desire title whenever the first sentence was
   * over 120 characters — and the better the prose got, the longer its
   * opening sentences became, so improving the writing broke more cards.
   */
  it("never falls back to the raw dream when there is prose to use", () => {
    const long =
      "An invoice notification flashes on your phone screen while you stand in the timber yard aisle, and the total is already familiar enough to be boring.";
    const hook = hookFrom(long, "I am earning $10k per week");

    expect(hook).not.toBe("I am earning $10k per week");
    expect(hook.length).toBeLessThanOrEqual(111);
    expect(hook.endsWith("…")).toBe(true);
    expect(long.startsWith(hook.slice(0, -1))).toBe(true);
  });

  it("uses a well-sized opening sentence untouched", () => {
    const body =
      "The gravel crunch stops under four heavy tires, and the cabin falls quiet. More text.";
    expect(hookFrom(body, "x")).toBe(
      "The gravel crunch stops under four heavy tires, and the cabin falls quiet.",
    );
  });

  it("borrows the next sentence when the first is a fragment", () => {
    expect(hookFrom("Second gear. The exhaust note changes.", "x")).toBe(
      "Second gear. The exhaust note changes.",
    );
  });

  it("cuts at a word boundary rather than mid-word", () => {
    const long =
      "The heavy rubber grip of the door handle feels cool against your palm as you press the thumb-button down and the panel swings wide.";
    const hook = hookFrom(long, "x");

    expect(hook.endsWith("…")).toBe(true);
    // Whatever it kept has to be a run of whole words from the original, so
    // the character it stopped before is a space.
    expect(long.startsWith(hook.slice(0, -1))).toBe(true);
    expect(long[hook.length - 1]).toBe(" ");
  });

  it("uses the dream only when there is no prose at all", () => {
    expect(hookFrom("", "My own defender car")).toBe("My own defender car");
  });
});

describe("displayHook", () => {
  /**
   * The miss that made the first fix invisible.
   *
   * `hook` is stored on the row when a story is written, so repairing the
   * writer repaired nothing that already existed — eleven rows had the user's
   * own dream saved as their hook and carried on showing it. Deriving at
   * display time fixes the rows already in the database.
   */
  it("ignores a stored hook that is really the user's typed dream", () => {
    expect(
      displayHook({
        body: "The gravel crunch stops under four heavy tires, and the cabin falls quiet. More.",
        hook: "I want to buy defender car",
        title: "I want to buy defender car",
        source: null,
      }),
    ).toBe("The gravel crunch stops under four heavy tires, and the cabin falls quiet.");
  });

  it("keeps a catalogue track's hand-written hook", () => {
    expect(
      displayHook({
        body: "Some long body text that would otherwise be used instead of the hook.",
        hook: "Put the day down",
        title: "Put the day down",
        source: "catalogue",
      }),
    ).toBe("Put the day down");
  });
});
