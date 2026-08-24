import { describe, expect, it } from "vitest";

import {
  buildTrackScript,
  linesNeededFor,
  PASSES,
  trackMinutes,
  trackSeconds,
} from "./affirmation-tracks";

/**
 * The bug these exist for: "it shows 10 mins but wordings is less and it keeps
 * repeating the same thing still 10 mins."
 *
 * The label was a hardcoded number nothing checked, and the player looped a
 * two-minute script to cover the gap. So the thing to assert is not that the
 * audio is long — it's that the STATED length and the ACTUAL length are the
 * same number, whatever the material happens to be.
 */

const LINE = "I am the kind of person who opens the banking app without flinching.";
const set = (count: number) => Array.from({ length: count }, (_, i) => `${LINE} ${i}`);

describe("trackSeconds", () => {
  it("grows with the number of lines", () => {
    expect(trackSeconds(set(20))).toBeGreaterThan(trackSeconds(set(10)));
  });

  it("counts every pass", () => {
    const once = trackSeconds(set(10), 1);
    const thrice = trackSeconds(set(10), 3);
    expect(thrice).toBeGreaterThan(once * 2);
  });

  it("allows for the silence between lines, not just the words", () => {
    // Twelve lines of ~12 words is about 82 seconds of pure speech. With the
    // 2.4s gaps it's over 110. Ignoring the gaps is how an 18-minute sleep
    // track once shipped with 89 words in it.
    const spokenOnly = (12 * 12) / 1.75;
    expect(trackSeconds(set(12), 1)).toBeGreaterThan(spokenOnly * 1.3);
  });
});

describe("trackMinutes", () => {
  it("never claims more than the audio delivers", () => {
    for (const count of [5, 8, 12, 20, 30]) {
      const lines = set(count);
      expect(trackMinutes(lines) * 60).toBeLessThanOrEqual(trackSeconds(lines));
    }
  });

  it("gives a short set a short label rather than padding it to ten", () => {
    // This is the exact reported case: twelve lines is not ten minutes.
    expect(trackMinutes(set(12))).toBeLessThan(10);
  });

  it("reaches ten minutes when there is genuinely ten minutes of material", () => {
    expect(trackMinutes(set(linesNeededFor(10)))).toBeGreaterThanOrEqual(10);
  });

  it("is never zero", () => {
    expect(trackMinutes(set(1))).toBeGreaterThanOrEqual(1);
  });
});

describe("linesNeededFor", () => {
  it("asks for more lines for a longer track", () => {
    expect(linesNeededFor(15)).toBeGreaterThan(linesNeededFor(5));
  });

  it("round-trips against the duration it was derived from", () => {
    for (const minutes of [3, 5, 10, 15]) {
      expect(trackMinutes(set(linesNeededFor(minutes)))).toBeGreaterThanOrEqual(minutes);
    }
  });
});

describe("buildTrackScript", () => {
  const seed = { theme: "Money", lines: set(6), category: "money" };

  it("contains every line once per pass", () => {
    const script = buildTrackScript(seed);
    const first = seed.lines[0]!;
    const occurrences = script.split(first).length - 1;
    expect(occurrences).toBe(PASSES);
  });

  it("settles the listener before it starts", () => {
    expect(buildTrackScript(seed).startsWith("Settle where you are.")).toBe(true);
  });

  /**
   * The script is now ONE pass, and the repetition comes from the player.
   *
   * Three passes were baked into the text, so a ten-minute track was three
   * times the characters and three times the ElevenLabs bill — per user, since
   * these are assembled from each person's own affirmations rather than shared
   * by title like the sleep tracks. 21 silent tracks were $6.05 at three
   * passes and are nearer $2.20 at one.
   *
   * The player already returns to the narration through a session, and now
   * resumes past the opening rather than from the top, so a repeat no longer
   * sounds like a tape rewinding — which was the only reason the passes needed
   * to be in the text with their own bridge lines.
   */
  it("writes one pass, leaving the repeats to the player", () => {
    expect(PASSES).toBe(1);
    const script = buildTrackScript(seed);
    expect(script).not.toMatch(/Again, slower\./);
  });

  it("still bridges properly if more passes are ever asked for", () => {
    // The mechanism stays, so raising PASSES remains a one-line decision
    // rather than a rewrite.
    const script = buildTrackScript(seed, 3);
    expect(script).toMatch(/Again, slower\./);
    expect(script).toMatch(/Once more\./);
  });

  it("says the opening and the close once, not once per pass", () => {
    const script = buildTrackScript(seed);
    expect(script.split("Settle where you are.").length - 1).toBe(1);
    expect(script.split("Stay here as long as you like.").length - 1).toBe(1);
  });

  it("puts a blank line between everything, so each line gets its own pause", () => {
    // The narration function splits on sentence boundaries and inserts the gap.
    // Lines crammed into one paragraph would be read as continuous prose.
    const script = buildTrackScript(seed);
    expect(script.split("\n\n").length).toBeGreaterThan(seed.lines.length * PASSES);
  });
});
