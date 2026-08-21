import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Guards on the story prompt, read from the edge function as text.
 *
 * Reading the source rather than importing it is deliberate: `ai-moment`
 * touches `Deno.env` at module scope, so importing it under Node crashes. The
 * text is what gets deployed, so the text is what's checked.
 *
 * These tests exist because of a specific report — "I typed I am earning 10k
 * per week, it shows aroma of bad weather and some kitchen stuff" — which was
 * accurate. The story never mentioned the money once. Every rule below traces
 * to a line I wrote that caused it.
 */
const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../supabase/functions/ai-moment/index.ts", import.meta.url)),
  "utf8",
);

/**
 * The file with its block comments removed.
 *
 * Needed because this file documents its own history by quoting the exact
 * instructions that caused each bug — so a test searching for a retired
 * instruction finds the explanation of why it was retired and fails. The first
 * run of these tests did precisely that.
 *
 * Only block comments are stripped. Line comments would take the `//` out of
 * `https://` with them.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

/** The assigned-moment list, pulled out of the source by its declaration. */
function moments(): string[] {
  const block = SOURCE.match(/const MOMENTS = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error("MOMENTS not found — did the declaration change shape?");
  return [...block[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

describe("assigned moments", () => {
  it("finds all sixteen", () => {
    expect(moments()).toHaveLength(16);
  });

  /**
   * The bug this replaces. The list was written while thinking about a
   * Defender, so half of it assumed a physical object — "coming back to it
   * after a few days away", "an unhurried afternoon with it". Handed "I am
   * earning $10k per week" there is no "it" to come back to, and the model
   * resolved that by inventing one: a money dream produced a story set in a
   * warm car.
   *
   * A desire comes in three shapes — a thing, a state, and an amount — and
   * every moment has to work for all three.
   */
  it("never assumes the desire is an object you can pick up", () => {
    const objectOnly = /\b(with|to|for|in|on)\s+it\b|\busing it\b|\buse of it\b/i;
    for (const moment of moments()) {
      expect(moment, `"${moment}" only works for a physical thing`).not.toMatch(objectOnly);
    }
  });

  /**
   * "Bad weather, and this making the difference" was pure scenery with no
   * connection to any desire. Given a weekly income it produced "The Aroma of
   * Bad Weather" — rain gear, a coffee grinder, toasted oats, no money.
   */
  it("never assigns weather as the subject of the scene", () => {
    for (const moment of moments()) {
      expect(moment).not.toMatch(/weather|rain|snow|sunshine/i);
    }
  });
});

describe("the prompt keeps the desire in charge", () => {
  /**
   * The ordering failure that caused the report.
   *
   * The desire was passed as a bare label — "WHAT THEY WANT: ..." — while the
   * sense got the only imperative in the block: "LEAD WITH THIS SENSE, and do
   * not lean on any other". So the strongest instruction in the context was
   * about scenery and the weakest was the dream, and the model obeyed exactly
   * what it was told.
   */
  it("does not let the assigned sense outrank the subject", () => {
    expect(CODE).not.toMatch(/LEAD WITH THIS SENSE/);
  });

  it("states the subject as a requirement rather than a label", () => {
    expect(CODE).toMatch(/WRITE ABOUT THIS, and nothing else/);
  });

  it("tells the model to drop the angle if it fights the subject", () => {
    expect(CODE).toMatch(/ignore that line and keep the subject/);
  });

  /**
   * A falsifiable check beats an adjective. "Be specific" is advice; "swap the
   * desire and see if the story still works" is something a model can actually
   * run against its own draft before answering.
   */
  it("gives the model a swap test it can apply to its own draft", () => {
    expect(CODE).toMatch(/swap in a completely different desire/);
  });

  it("requires the desire to appear early and in the user's own words", () => {
    expect(CODE).toMatch(/by the second sentence/);
  });

  /** Kitchens and coffee were the actual content of the reported story. */
  it("bans the kitchen opening unless the kitchen is the dream", () => {
    expect(CODE).toMatch(/Do not open on food, cooking, coffee or a kitchen/);
  });
});
