import { describe, expect, it } from "vitest";

import { dayIndex, eveningPhrase } from "./voice.ts";

/**
 * These test the two things that can silently go wrong with rotating copy, and
 * which nobody would notice from reading the file.
 *
 * The first is repetition. The evening push used to be one hardcoded line, so
 * the only way the rotation can fail is by not rotating — and a notification
 * that says the same thing every night is the state we just left.
 *
 * The second is timezone drift. `dayIndex` parses the date by hand precisely
 * so the runtime's own timezone cannot shift the answer across a boundary, and
 * that is worth pinning: it would only break for users far from UTC, which is
 * to say not on the developer's machine.
 */

const DATES = Array.from(
  { length: 21 },
  (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
);

describe("eveningPhrase", () => {
  it("never repeats on consecutive nights", () => {
    const titles = DATES.map((d) => eveningPhrase({}, d).title);
    for (let i = 1; i < titles.length; i++) {
      expect(titles[i], `repeat on ${DATES[i]}`).not.toBe(titles[i - 1]);
    }
  });

  it("uses every line it has before repeating any", () => {
    // Seven lines, so seven consecutive nights should produce seven distinct
    // titles. A smaller number means a line is unreachable — an off-by-one in
    // the modulo, usually.
    const week = DATES.slice(0, 7).map((d) => eveningPhrase({}, d).title);
    expect(new Set(week).size).toBe(7);
  });

  it("is stable for a given date", () => {
    // Two sends on the same night — a retry, or two devices — must say the
    // same thing. Random selection would not.
    const a = eveningPhrase({ firstName: "Viggnesh" }, "2026-10-09");
    const b = eveningPhrase({ firstName: "Viggnesh" }, "2026-10-09");
    expect(a).toEqual(b);
  });

  it("uses the first name only where a line asks for one", () => {
    const named = DATES.slice(0, 7).map((d) => eveningPhrase({ firstName: "Viggnesh" }, d).title);
    const anon = DATES.slice(0, 7).map((d) => eveningPhrase({}, d).title);
    expect(named.some((t) => t.includes("Viggnesh"))).toBe(true);
    // And every line must still read correctly with no name at all, which is
    // the case for anybody who signed up with Google and never set one.
    expect(anon.every((t) => t.length > 0 && !t.includes("undefined"))).toBe(true);
    expect(anon.every((t) => !t.startsWith(","))).toBe(true);
  });

  it("never scolds, counts or hurries", () => {
    // The three rules at the top of voice.ts, enforced rather than trusted.
    // "!" is the giveaway for urgency; the rest are the words that turn a
    // wind-down into a performance review.
    const banned = /streak|don't forget|missed|again today|you haven't|catch up|!/i;
    for (const d of DATES) {
      const { title, body } = eveningPhrase({ firstName: "Viggnesh" }, d);
      expect(`${title} ${body}`, `on ${d}`).not.toMatch(banned);
    }
  });

  it("stays short enough for a lock screen", () => {
    // Android truncates around 65 characters on the title line; past that the
    // end of the sentence is simply never read.
    for (const d of DATES) {
      const { title, body } = eveningPhrase({ firstName: "Viggnesh" }, d);
      expect(title.length, `title on ${d}`).toBeLessThanOrEqual(48);
      expect(body.length, `body on ${d}`).toBeLessThanOrEqual(90);
    }
  });
});

describe("dayIndex", () => {
  it("advances by exactly one per calendar day", () => {
    expect(dayIndex("2026-10-10") - dayIndex("2026-10-09")).toBe(1);
  });

  it("crosses month and year boundaries cleanly", () => {
    expect(dayIndex("2026-11-01") - dayIndex("2026-10-31")).toBe(1);
    expect(dayIndex("2027-01-01") - dayIndex("2026-12-31")).toBe(1);
  });

  it("does not depend on the host timezone", () => {
    // The real failure mode: `new Date("2026-10-09")` is UTC midnight, and in
    // a negative-offset timezone that is the 8th locally. Hand-parsing makes
    // the answer identical everywhere, which is what this asserts.
    const before = process.env.TZ;
    const seen = new Set<number>();
    for (const tz of ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"]) {
      process.env.TZ = tz;
      seen.add(dayIndex("2026-10-09"));
    }
    process.env.TZ = before;
    expect(seen.size).toBe(1);
  });

  it("falls back rather than throwing on a malformed date", () => {
    // A null or odd `sent_for` must not take the whole send down; a dull line
    // is better than no notification and a 500.
    expect(dayIndex("")).toBe(0);
    expect(dayIndex("not-a-date")).toBe(0);
    expect(() => eveningPhrase({}, "")).not.toThrow();
  });
});
