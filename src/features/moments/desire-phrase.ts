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

/**
 * Verbs where the desire is the OBJECT, not the activity.
 *
 * "I want to buy defender car" became "buying defender car", which then went
 * into sentences as "buying defender car is yours now" and "you haven't
 * thought about wanting buying defender car in weeks". Reported, correctly, as
 * not feeling real — mangling someone's own words is the fastest way to break
 * the spell.
 *
 * The gerund is right for things you DO: earning 20000cr, launching my app,
 * travelling more. It is wrong for things you HAVE. Nobody wants the activity
 * of buying a Defender; they want the Defender.
 *
 * Split into strong and weak because of "get". "get a new job" is an
 * acquisition and "get fit" is not, and the difference isn't in the verb — so
 * a weak verb only counts as acquisition when a determiner follows it and
 * makes the object unambiguous. Strong verbs take an object either way.
 */
const ACQUIRE_STRONG = new Set(["buy", "purchase", "own", "afford"]);
const ACQUIRE_WEAK = new Set(["get", "have", "attract", "land", "receive", "obtain"]);

/** Words that mark what follows as a thing rather than a state. */
const DETERMINERS = new Set(["a", "an", "the", "my", "our", "your", "his", "her", "their"]);

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

  /**
   * Acquisition first: the object is the desire, so drop the verb entirely.
   *
   * "buy defender car" → "your defender car", not "buying defender car".
   * Every caller splices this into a noun slot — "X is yours now", "for whom X
   * is ordinary", "X is simply part of your life" — so a noun is what they all
   * need. The gerund reads as an activity and turns the sentence into nonsense.
   */
  if (rest) {
    const nextWord = rest
      .split(/\s+/)[0]!
      .toLowerCase()
      .replace(/[^a-z']/g, "");
    const hasDeterminer = DETERMINERS.has(nextWord);
    if (ACQUIRE_STRONG.has(first) || (ACQUIRE_WEAK.has(first) && hasDeterminer)) {
      // A determiner already settles whose it is. Without one, "your" does,
      // and it reads better than the bare noun in every slot this feeds.
      return hasDeterminer ? rest.toLowerCase() : `your ${rest}`.toLowerCase();
    }
  }

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

/**
 * Head nouns that take no article, because they name a quantity or a state
 * rather than a thing you could count.
 *
 * "a financial freedom" and "a confidence" are as broken as the missing article
 * this list exists to avoid, so the check is on the LAST word of the phrase —
 * the head noun — not the first. "financial freedom" ends in `freedom`;
 * "dream job offer" ends in `offer`.
 *
 * Deliberately short. Every entry here is a word that actually appears in this
 * app's own trending list or in the goals people have already typed, and a
 * missing entry produces a slightly wrong article rather than nonsense.
 */
const MASS_NOUNS = new Set([
  "abundance",
  "balance",
  "calm",
  "clarity",
  "closure",
  "confidence",
  "courage",
  "discipline",
  "energy",
  "focus",
  "forgiveness",
  "freedom",
  "growth",
  "happiness",
  "healing",
  "health",
  "independence",
  "joy",
  "love",
  "money",
  "patience",
  "peace",
  "progress",
  "recognition",
  "respect",
  "rest",
  "security",
  "self-worth",
  "sleep",
  "stability",
  "space",
  "stillness",
  "success",
  "time",
  "wealth",
  "wellbeing",
  "work",
]);

/** Words that already settle the article question. */
const ARTICLED = new Set([
  ...DETERMINERS,
  "more",
  "less",
  "enough",
  "unlimited",
  "another",
  "every",
  "all",
  "no",
  "one",
  "two",
  "three",
  "some",
  "any",
  "this",
  "that",
  "these",
  "those",
]);

/**
 * Adds "a" or "an" to a phrase that needs one.
 *
 * `desirePhrase` returns something that reads correctly after a preposition —
 * "buying a Defender" became "your defender car", "my aim is to earn 20000cr"
 * became "earning 20000cr". But a bare noun phrase falls through untouched, so
 * "Dream job offer" came back as "dream job offer" and the practice screen read:
 *
 *     "I am becoming the kind of person for whom dream job offer is ordinary."
 *
 * That sentence is on the screen carrying the entire personalisation promise,
 * and a missing article is the clearest possible signal that a machine wrote it
 * without reading it back.
 *
 * Four things skip the article, each because adding one would be worse than
 * leaving it off: an existing determiner, a gerund ("getting over him"), a
 * plural ("$10k months"), and a mass noun ("financial freedom").
 */
export function withArticle(phrase: string): string {
  const words = phrase.trim().split(/\s+/);
  if (words.length === 0) return phrase;

  const first = words[0]!.toLowerCase().replace(/[^a-z'-]/g, "");
  const head = words[words.length - 1]!.toLowerCase().replace(/[^a-z'-]/g, "");

  // Already determined: "my own apartment", "a calmer mind", "your defender car".
  if (ARTICLED.has(first)) return phrase;

  // A gerund names an activity, and activities take no article. `desirePhrase`
  // produces these deliberately, so this is the common case rather than an edge.
  if (first.endsWith("ing") && first.length > 4) return phrase;

  // Anything that doesn't start with a letter — "$10k months", "20000cr by
  // December" — is not a shape an article helps.
  if (!/^[a-z]/.test(first)) return phrase;

  if (MASS_NOUNS.has(head)) return phrase;

  // Plural. "months", "clients", "offers" — but not "business" or "success",
  // where the trailing s is part of the word.
  if (/[^s]s$/.test(head)) return phrase;

  // "an" before a vowel SOUND, which is close enough to a vowel letter for the
  // words that reach here. The exceptions are the ones people notice: a
  // one-bedroom flat, a university place, an hour.
  const startsVowelSound =
    /^(hour|honest|honour|heir)/.test(first) ||
    (/^[aeiou]/.test(first) && !/^(one|once|uni|use|user|euro|ubiquit)/.test(first));

  return `${startsVowelSound ? "an" : "a"} ${phrase}`;
}

/**
 * The desire as a noun phrase that can sit in "for whom ___ is ordinary".
 *
 * The fallback is returned untouched: "what you're working toward" is already a
 * complete noun phrase and putting an article in front of it would reintroduce
 * exactly the bug this exists to fix.
 */
export function desireNounPhraseOr(rawTitle: string, fallback = GENERIC_DESIRE): string {
  const phrase = desirePhrase(rawTitle);
  return phrase === null ? fallback : withArticle(phrase);
}
