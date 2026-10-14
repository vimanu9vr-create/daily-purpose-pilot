import { describe, expect, it } from "vitest";

import { freeAudioCaption, freeAudioFor } from "./free-audio";

const base = { kind: "sleep", title: "Deep Rest", block: "needs-voice-plan" as const, hasNarration: false };

describe("freeAudioFor", () => {
  it("plays nothing when narration exists", () => {
    // The bed replaces silence, it does not layer under the voice. The
    // narration already ships with its own pad; doubling them is mud.
    expect(freeAudioFor({ ...base, hasNarration: true })).toEqual({ kind: "none" });
  });

  it("plays nothing when narration is not blocked", () => {
    expect(freeAudioFor({ ...base, block: "none" })).toEqual({ kind: "none" });
  });

  it("plays the real tone for a frequency track", () => {
    // Not the pad. The frequency IS the track — substituting it would remove
    // the one thing the listener opened it for.
    expect(
      freeAudioFor({ ...base, kind: "frequency", title: "Renewal 528 Hz" }),
    ).toEqual({ kind: "tone", frequencyHz: 528 });
  });

  it("falls back to the pad for a frequency we ship no file for", () => {
    // 432 has no recording. Silence would be worse than the bed.
    expect(freeAudioFor({ ...base, kind: "frequency", title: "Drift 432 Hz" })).toEqual({
      kind: "pad",
    });
  });

  it("plays the pad for sleep and meditation", () => {
    expect(freeAudioFor({ ...base, kind: "sleep" })).toEqual({ kind: "pad" });
    expect(freeAudioFor({ ...base, kind: "meditation", title: "Morning Still" })).toEqual({
      kind: "pad",
    });
  });

  it("plays nothing for a written story", () => {
    // A story has no ambient identity. Playing a pad under a refused story
    // invents a feature rather than previewing one.
    expect(freeAudioFor({ ...base, kind: "story" })).toEqual({ kind: "none" });
    expect(freeAudioFor({ ...base, kind: null })).toEqual({ kind: "none" });
  });

  it("survives a missing title", () => {
    expect(freeAudioFor({ ...base, kind: "frequency", title: null })).toEqual({ kind: "pad" });
  });
});

describe("freeAudioCaption", () => {
  it("says nothing when no bed is playing", () => {
    expect(freeAudioCaption("needs-voice-plan", { kind: "none" })).toBeNull();
  });

  it("points a Standard subscriber at the plan, not at tomorrow", () => {
    // Telling them to come back tomorrow sends them back to find nothing
    // changed. This is the bug this distinction exists to prevent.
    const caption = freeAudioCaption("needs-voice-plan", { kind: "pad" });
    expect(caption).toContain("Voice plan");
    expect(caption).not.toContain("tomorrow");
  });

  it("points a Voice subscriber at tomorrow, not at the plan", () => {
    const caption = freeAudioCaption("daily-limit", { kind: "pad" });
    expect(caption).toContain("tomorrow");
    expect(caption).not.toContain("Voice plan");
  });

  it("takes the blame when the fault is ours", () => {
    expect(freeAudioCaption("unavailable", { kind: "pad" })).toContain("on us");
  });

  it("names the frequency when a tone is playing", () => {
    expect(freeAudioCaption("needs-voice-plan", { kind: "tone", frequencyHz: 528 })).toContain(
      "528 Hz",
    );
  });
});
