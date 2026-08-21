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

/** Just the text sent to the model — not the comments explaining it. */
function systemPrompt(): string {
  const match = SOURCE.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
  if (!match) throw new Error("SYSTEM_PROMPT not found — did the declaration change shape?");
  return match[1]!;
}

/**
 * A line that forbids something. Naming a word in order to ban it is safe;
 * naming it anywhere else is an instruction to use it.
 */
function isBan(line: string): boolean {
  return /never|do not|don't|banned|avoid|gibberish/i.test(line);
}

describe("no concrete noun leaks out of the prompt as an example", () => {
  /**
   * THE MISTAKE THIS FILE EXISTS TO STOP. Made three times now.
   *
   * 1. The prompt named three Defender details to illustrate "specific".
   *    Nine of the next twelve stories mentioned diesel clatter.
   * 2. The prompt said "the ordinary-Tuesday version is the one that does
   *    something", as a figure of speech. Thirteen of twenty-nine stories
   *    named Tuesday. Zero named Wednesday, Thursday, Saturday or Sunday.
   * 3. The prompt offered "The kettle has boiled twice and nobody has made the
   *    tea" as a good opening. Nine of twenty-nine were kitchen scenes — while
   *    the line directly above it banned kitchen openings. The example beat the
   *    ban, because an example is concrete and a ban is abstract.
   *
   * The file's own notes already say "an example in a prompt is not an
   * illustration, it is an instruction, and it is the strongest one in the
   * file". I wrote that, then did it twice more. Hence a test rather than a
   * resolution.
   */
  const STICKY = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "kettle",
    "kitchen",
    "mug",
    "coffee",
    "diesel",
  ];

  it("mentions a concrete noun only in order to forbid it", () => {
    const offenders: string[] = [];
    for (const line of systemPrompt().split("\n")) {
      if (isBan(line)) continue;
      for (const noun of STICKY) {
        if (new RegExp(`\\b${noun}`, "i").test(line))
          offenders.push(`"${noun}" in: ${line.trim()}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  /**
   * Illustrations are the delivery mechanism. Structural description — "an
   * object, a sound, a negation" — tells the model the SHAPE without handing
   * it contents to copy.
   */
  it("describes the shape of a good opening instead of demonstrating one", () => {
    const openingRules = systemPrompt()
      .split("\n")
      .filter((line) => /^- Open on/.test(line));
    expect(openingRules.length).toBeGreaterThan(0);
    for (const rule of openingRules) {
      expect(rule, "an example sentence in quotes will become the cliché").not.toMatch(/"/);
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

  it("requires the desire to appear early, and to be shown rather than announced", () => {
    expect(CODE).toMatch(/SHOWN AS PART OF THE SCENE, never announced/);
  });

  /**
   * The regression the first version of this fix caused.
   *
   * "Use their own words" was written for a noun. "Defender car" drops into a
   * sentence fine. "I am earning $10k per week" is a first-person sentence
   * about a wish, and these stories are second-person descriptions of a life —
   * so reproducing it exactly produced "Now that I am earning $10k per week,
   * your Tuesdays do not have an urgency."
   *
   * Ten of twenty-four stories carried "I" or "my" into a "you" story.
   */
  it("asks for the user's nouns and numbers, never their sentence", () => {
    expect(CODE).toMatch(/TAKE THEIR NOUNS AND NUMBERS\. NEVER THEIR SENTENCE/);
    expect(CODE).not.toMatch(/Use their exact words/);
  });

  it("forbids first person outright, since the story is second person", () => {
    expect(CODE).toMatch(/NEVER write "I", "I'm", "I am" or "my"/);
  });

  /**
   * "Mention it by sentence two" is a requirement a model satisfies in the
   * laziest way that technically complies — by bolting on a causal clause.
   * Seven of twenty-four did exactly that, so they're banned by name.
   */
  it("bans the bolted-on causal clause by name", () => {
    for (const cheat of ["Because", "Now that", "Ever since", "Thanks to"]) {
      expect(CODE).toMatch(new RegExp(`"${cheat}`));
    }
  });

  /** Kitchens and coffee were the actual content of the reported story. */
  it("bans the kitchen opening unless the kitchen is the dream", () => {
    expect(CODE).toMatch(/Do not open on food, cooking, coffee or a kitchen/);
  });
});
