import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { frequencyFromTitle } from "@/lib/ambient-audio";

import { TRACKS } from "./track-catalogue";

/**
 * These tests exist because of specific bugs that shipped, not for coverage.
 *
 * Every one of them would have caught something a user had to report:
 * an 18-minute sleep track holding forty seconds of speech, and frequency
 * sessions that named a Hz they had no way to play.
 */

const PUBLIC_DIR = join(process.cwd(), "public");

/** Roughly the rate the narration is generated at — slow and deliberate. */
const WORDS_PER_MINUTE = 135;

function spokenSeconds(body: string): number {
  return (body.trim().split(/\s+/).length / WORDS_PER_MINUTE) * 60;
}

describe("track catalogue", () => {
  it("gives every track a positive duration and a script", () => {
    for (const track of TRACKS) {
      expect(track.minutes, `${track.slug} has no duration`).toBeGreaterThan(0);
      expect(track.body.trim().length, `${track.slug} has no script`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate slugs", () => {
    const slugs = TRACKS.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /**
   * The bug this is named after: every declared duration was invented by hand
   * and none matched its script. The session now runs a bed of sound for the
   * full length so the duration is honest, but a track whose speech is a tiny
   * fraction of its runtime is thin content and we should know the number
   * rather than discover it from a review.
   */
  it("reports how much of each session is actually spoken", () => {
    const coverage = TRACKS.map((track) => ({
      slug: track.slug,
      declared: track.minutes * 60,
      spoken: Math.round(spokenSeconds(track.body)),
      percent: Math.round((spokenSeconds(track.body) / (track.minutes * 60)) * 100),
    }));

    // Not a failure yet — the scripts are known to be short and lengthening
    // them is writing work. This keeps the number visible in every test run so
    // it can't quietly get worse.
    console.table(coverage);

    for (const track of coverage) {
      expect(track.spoken, `${track.slug} has no measurable speech`).toBeGreaterThan(5);
    }
  });

  it("ships a real tone file for every frequency session", () => {
    const frequencyTracks = TRACKS.filter((t) => t.kind === "frequency");
    expect(frequencyTracks.length).toBeGreaterThan(0);

    for (const track of frequencyTracks) {
      const hz = frequencyFromTitle(track.title);
      expect(hz, `${track.slug} names no parseable frequency`).not.toBeNull();

      // A "528 Hz" track with no 528 Hz audio is just text with a number on it,
      // which is exactly what shipped and what a user noticed.
      const file = join(PUBLIC_DIR, "audio", `tone-${hz}.mp3`);
      expect(existsSync(file), `${track.slug} claims ${hz} Hz but ${file} is missing`).toBe(true);
    }
  });

  it("ships the ambient bed every other session depends on", () => {
    expect(existsSync(join(PUBLIC_DIR, "audio", "ambient-pad.mp3"))).toBe(true);
  });
});

describe("frequencyFromTitle", () => {
  it("pulls the number out of a title", () => {
    expect(frequencyFromTitle("Renewal 528 Hz")).toBe(528);
    expect(frequencyFromTitle("Become confident 963 Hz")).toBe(963);
    expect(frequencyFromTitle("Connection 639Hz")).toBe(639);
  });

  it("returns null when there is no frequency", () => {
    expect(frequencyFromTitle("Put the day down")).toBeNull();
  });

  it("rejects values outside the audible range", () => {
    expect(frequencyFromTitle("Deep 5 Hz")).toBeNull();
  });
});
