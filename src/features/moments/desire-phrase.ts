/**
 * Turns whatever someone typed as a desire into something that can be dropped
 * into the middle of a sentence.
 *
 * The templates were written assuming desires arrive as tidy noun phrases —
 * "a calmer mind", "my own apartment" — because those are the examples in the
 * placeholder. Real people type sentences. Someone wrote "my aim is to earn
 * 20000cr" and the app produced:
 *
 *     "before you started working toward my aim is to earn 20000cr."
 *
 * which reads like a bug, because it is one. Every template that splices the
 * title had the same hole.
 *
 * Three passes:
 *
 * 1. Strip the first-person framing people habitually write ("I want to…",
 *    "my goal is…"), which is scaffolding rather than the desire itself.
 * 2. If what's left starts with a verb, turn it into a gerund, since every
 *    slot in the templates sits after a preposition or in subject position —
 *    "working toward earning 20000cr" is grammatical, "toward earn" is not.
 * 3. If we can't tell what shape it is, return null and let the caller fall
 *    back to a generic phrase. A slightly vaguer sentence is much better than
 *    a broken one, and this is the case that will keep happening as people
 *    type things nobody predicted.
 */

const FRAMING = [
  /^my (?:aim|goal|dream|wish|plan|intention|target|desire|ambition)s? (?:is|are) to\s+/i,
  /^my (?:aim|goal|dream|wish|plan|intention|target|desire|ambition)s? (?:is|are)\s+/i,
  /^my (?:aim|goal|dream|wish|plan|intention|target|desire|ambition)s?\s*[:–—-]\s*/i,
  /^i (?:want|wish|hope|need|aim|intend|plan|would like|'d like|d like) to\s+/i,
  /^i (?:want|wish|need)\s+/i,
  /^i (?:am|'m|m) manifesting\s+/i,
  /^manifesting\s+/i,
  /^to\s+/i,
];

/** Verbs people actually start a desire with. Conservative on purpose. */
const VERBS = new Set([
  "achieve",
  "afford",
  "attract",
  "become",
  "begin",
  "build",
  "buy",
  "complete",
  "create",
  "earn",
  "feel",
  "find",
  "finish",
  "gain",
  "get",
  "grow",
  "have",
  "heal",
  "hit",
  "land",
  "launch",
  "learn",
  "leave",
  "live",
  "look",
  "lose",
  "make",
  "meet",
  "move",
  "open",
  "own",
  "publish",
  "quit",
  "reach",
  "release",
  "run",
  "save",
  "sell",
  "start",
  "stop",
  "travel",
  "win",
  "work",
  "write",
]);

const IRREGULAR: Record<string, string> = {
  be: "being",
  begin: "beginning",
  get: "getting",
  hit: "hitting",
  quit: "quitting",
  run: "running",
  sit: "sitting",
  stop: "stopping",
  travel: "travelling",
  win: "winning",
};

/** Determiners and possessives that mark something as already a noun phrase. */
const NOUNISH = new Set([
  "a",
  "an",
  "the",
  "my",
  "our",
  "more",
  "less",
  "better",
  "deeper",
  "greater",
  "financial",
  "total",
  "complete",
  "real",
  "true",
  "inner",
  "new",
  "another",
  "enough",
  "unlimited",
  "lasting",
  "genuine",
]);

function gerund(verb: string): string {
  const known = IRREGULAR[verb];
  if (known) return known;
  // "live" → "living", but "see" → "seeing".
  if (verb.endsWith("e") && !verb.endsWith("ee")) return `${verb.slice(0, -1)}ing`;
  // Consonant-vowel-consonant doubles the final letter: "plan" → "planning".
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(verb)) return `${verb}${verb.slice(-1)}ing`;
  return `${verb}ing`;
}

/**
 * A phrase that can follow a preposition, or null if we aren't confident.
 *
 * Null is a real answer here, not a failure — it's what stops an unpredictable
 * input from producing a broken sentence.
 */
export function desirePhrase(rawTitle: string): string | null {
  let text = rawTitle.trim().replace(/[.!?]+$/, "");
  if (!text) return null;

  for (const pattern of FRAMING) {
    const stripped = text.replace(pattern, "");
    if (stripped !== text) {
      text = stripped.trim();
      break;
    }
  }
  if (!text) return null;

  // Long enough to be a whole thought rather than a phrase. Splicing it would
  // read badly however we handle the first word.
  const words = text.split(/\s+/);
  if (words.length > 9) return null;

  const first = words[0]!.toLowerCase().replace(/[^a-z']/g, "");
  const rest = words.slice(1).join(" ");

  if (VERBS.has(first)) {
    return rest ? `${gerund(first)} ${rest}`.toLowerCase() : gerund(first);
  }
  if (NOUNISH.has(first)) return text.toLowerCase();

  // Starts with something else — a bare noun ("money", "confidence"), a name,
  // a number. Bare nouns splice fine; anything stranger is caught by the word
  // limit above, and a wrong guess here is cheap.
  if (/^[a-z]/i.test(words[0]!)) return text.toLowerCase();

  return null;
}

/** What a template says when the desire can't be spliced safely. */
export const GENERIC_DESIRE = "what you're working toward";

/** Convenience: the phrase, or the generic fallback. Never returns null. */
export function desirePhraseOr(rawTitle: string, fallback = GENERIC_DESIRE): string {
  return desirePhrase(rawTitle) ?? fallback;
}
