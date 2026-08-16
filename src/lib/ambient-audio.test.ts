import { describe, expect, it } from "vitest";

import { frequencyFromTitle } from "./ambient-audio";

/**
 * The audio itself can't be tested here — it needs a real browser and real
 * ears, which is how the gap and the bare tone survived this long. What can be
 * asserted is the one piece of pure logic in the file, and the shipped files.
 */
describe("frequencyFromTitle", () => {
  it("finds the frequency in a real title", () => {
    expect(frequencyFromTitle("Renewal 528 Hz")).toBe(528);
    expect(frequencyFromTitle("963Hz — the crown")).toBe(963);
    expect(frequencyFromTitle("Connection 639 hz")).toBe(639);
  });

  it("returns null when there isn't one", () => {
    expect(frequencyFromTitle("The walk home")).toBeNull();
    expect(frequencyFromTitle("")).toBeNull();
  });

  it("rejects numbers outside human hearing", () => {
    // A "5 Hz" or "50000 Hz" track would play an inaudible file and read as
    // broken. Better to fall through to the ambient bed.
    expect(frequencyFromTitle("Deep 5 Hz")).toBeNull();
    expect(frequencyFromTitle("Ultra 50000 Hz")).toBeNull();
  });

  it("doesn't pick up numbers that aren't frequencies", () => {
    expect(frequencyFromTitle("10 minutes to sleep")).toBeNull();
    expect(frequencyFromTitle("Day 21")).toBeNull();
  });
});
