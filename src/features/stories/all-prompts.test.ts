import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Guards that apply to EVERY prompt in the app, not just the story one.
 *
 * The story prompt got its own tests after three separate incidents where a
 * word I put in it came back in the output — diesel clatter, Tuesday, a
 * kitchen. Those tests only covered `ai-moment`, which left five other prompts
 * free to make the same mistake, and one of them already had: the milestone
 * prompt prescribed a fixed five-stage arc, and five completely unrelated
 * dreams came back with byte-identical steps.
 *
 * A guard on one file is a guard on the last place the bug happened. These
 * apply everywhere.
 */
const FUNCTIONS_DIR = fileURLToPath(new URL("../../../supabase/functions", import.meta.url));

/** Every prompt in the app, as { function name, prompt text }. */
function allPrompts(): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = [];

  for (const dir of readdirSync(FUNCTIONS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    let source: string;
    try {
      source = readFileSync(`${FUNCTIONS_DIR}/${dir.name}/index.ts`, "utf8");
    } catch {
      continue;
    }
    // Comments quote retired instructions to explain them; only the live
    // template literals are sent to a model.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of code.matchAll(/(?:SYSTEM_PROMPT|PROMPT)\s*=\s*`([\s\S]*?)`;/g)) {
      found.push({ name: dir.name, text: match[1]! });
    }

    /**
     * The lists that get interpolated INTO a prompt count as prompt too.
     *
     * This was checking template literals only, so `MOMENTS` and `REGISTERS`
     * were invisible to it — and that is exactly where the next leak was. The
     * ban on naming a weekday was in the prompt while the phrase "an ordinary
     * WEEKDAY morning" sat in MOMENTS, in the same request. Three of six
     * stories named a day. The prime beat the ban, and the guard never looked
     * at the half of the request the prime was in.
     */
    for (const match of code.matchAll(/const (?:MOMENTS|REGISTERS)\s*=\s*\[([\s\S]*?)\n\];/g)) {
      found.push({ name: `${dir.name} (assigned list)`, text: match[1]! });
    }
  }
  return found;
}

describe("every prompt in the app", () => {
  it("finds prompts to check", () => {
    expect(allPrompts().length).toBeGreaterThanOrEqual(4);
  });

  /**
   * Words that have already come back in output after being written into a
   * prompt. Naming one in order to forbid it is safe; naming it anywhere else
   * is an instruction to use it.
   */
  const STICKY = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    // "weekday" is here because banning the seven names did not work. Three of
    // six stories still named a day, and the pull was coming from the assigned
    // moment "an ordinary WEEKDAY morning" — a word I had left in while adding
    // the rule against it. The negative instruction and the positive prime were
    // in the same request, and the prime won, as it has every time.
    "weekday",
    "kettle",
    "kitchen",
    "mug",
    "diesel",
  ];

  const forbids = (line: string) =>
    /never|not\b|no\b|don't|banned|avoid|wrong|gibberish|instead of/i.test(line);

  it("names a sticky noun only in order to forbid it", () => {
    const offenders: string[] = [];
    for (const { name, text } of allPrompts()) {
      for (const line of text.split("\n")) {
        if (forbids(line)) continue;
        for (const noun of STICKY) {
          if (new RegExp(`\\b${noun}`, "i").test(line)) {
            offenders.push(`${name}: "${noun}" in — ${line.trim().slice(0, 90)}`);
          }
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  /**
   * The milestone failure, generalised.
   *
   * A prompt that prescribes a fixed sequence of stages produces the same
   * sequence for every input, which is a template with extra steps. Five
   * unrelated dreams — "$10k months", "A calmer mind", "Going viral", "Being
   * chosen clearly", "Being the person my family relies on" — came back with
   * identical milestones because of one numbered list in one prompt.
   */
  it("does not prescribe a fixed numbered arc for the model to follow", () => {
    for (const { name, text } of allPrompts()) {
      const numbered = text.match(/^\s*[1-9]\.\s+\S/gm) ?? [];
      expect(
        numbered.length,
        `${name} lists ${numbered.length} numbered stages — every input will come back in that shape`,
      ).toBeLessThan(4);
    }
  });

  /**
   * Every prompt must say, in some form, that output has to be specific to
   * this user's own words. Without it the model defaults to what fits
   * everyone, which is what "generic" means.
   */
  it("tells the model to write from what this particular person typed", () => {
    // Assigned lists are fragments interpolated into a prompt; the instruction
    // lives in the prompt they're interpolated into, not in each entry.
    for (const { name, text } of allPrompts().filter((p) => !p.name.includes("assigned list"))) {
      expect(
        text,
        `${name} never tells the model to use the user's own words or stay on their subject`,
      ).toMatch(/their (own )?\w*\s?(words|vocabulary|nouns)|WRITE ABOUT THIS|STAY ON/i);
    }
  });
});
