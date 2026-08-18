import { describe, expect, it } from "vitest";

import { interleaveByDesire } from "./use-stories";

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
