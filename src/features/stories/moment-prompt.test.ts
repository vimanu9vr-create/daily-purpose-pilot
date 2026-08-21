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

describe("time of day is assigned, not forbidden", () => {
  /**
   * The fourth ban I wrote today, and the fourth to be worked around.
   *
   * Thirteen of twenty-nine stories named Tuesday; none named Wednesday,
   * Thursday, Saturday or Sunday. Removing the priming word and adding "DO NOT
   * NAME A DAY OF THE WEEK" still left one in three naming a day.
   *
   * A scene has to be anchored in time, "an ordinary Tuesday" is the most
   * available way to do that in English, and a ban leaves the need in place
   * with nothing to meet it. Assigning a time of day meets the need, the same
   * way assigned REGISTERS fixed diesel clatter and assigned MOMENTS fixed
   * every story being the same scene.
   */
  it("hands the model a time of day to anchor the scene in", () => {
    const block = SOURCE.match(/const TIMES = \[([\s\S]*?)\n\];/);
    expect(block, "TIMES not found — the ban is doing the work again").toBeTruthy();

    const times = [...block![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    expect(times.length).toBeGreaterThanOrEqual(6);
    for (const time of times) {
      expect(time).not.toMatch(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
    }
  });

  it("sends the assigned time in the request", () => {
    expect(CODE).toMatch(/WHEN IN THE DAY THIS HAPPENS/);
    expect(CODE).toMatch(/timeFor\(variant, subject\.title\)/);
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

  it("requires the subject to be inferable from detail rather than stated", () => {
    expect(CODE).toMatch(/FROM THE CONCRETE DETAILS ALONE, without it ever being stated/);
  });

  /**
   * Banning a construction just moves it.
   *
   * Causal clauses went to zero after they were banned by name. The next batch
   * put the same pasted sentence after a colon instead — "what is now
   * completely ordinary: I am making $10k a week" — in four of twelve stories,
   * and a fifth said it out loud in dialogue, which an earlier version of the
   * rule had explicitly allowed.
   *
   * So the requirement that produces the tic is gone. There must be no
   * instruction anywhere telling the model to STATE the subject, only to make
   * it inferable.
   */
  it("no longer asks the model to state the subject at all", () => {
    expect(CODE).not.toMatch(/UNMISTAKABLY PRESENT/);
    expect(CODE).not.toMatch(/by the second sentence/);
  });

  it("closes the dialogue and colon loopholes explicitly", () => {
    expect(CODE).toMatch(/not spoken aloud, not printed on a screen, not after a colon/);
    expect(CODE).toMatch(/Anywhere, including inside quotation marks/);
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
    expect(CODE).toMatch(/THE SENTENCE THEY TYPED MUST NEVER APPEAR IN THE STORY/);
    expect(CODE).toMatch(/Take their NOUNS AND NUMBERS instead/);
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
