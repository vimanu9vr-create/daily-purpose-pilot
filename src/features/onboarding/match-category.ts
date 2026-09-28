/**
 * Which of the selected focus areas a typed sentence is actually about.
 *
 * ## The bug this replaces
 *
 * Onboarding offers thirteen focus areas as a multi-select and saves every
 * one. But three places downstream took `focusAreas[0]` — the first area the
 * person happened to tap — and used it as THE category for their desire,
 * their goal, and their seeded affirmations.
 *
 * `category` is what chooses cover images, filters the affirmations list and
 * builds the library rows. So someone who tapped Money first and then Career,
 * Confidence and Love got an app that was entirely about money, with the other
 * three stored in `profiles.focus_areas` and never read again. Tap order — an
 * accident — decided what the product looked like.
 *
 * ## What this does instead
 *
 * Reads the sentence they actually typed and picks whichever of THEIR chosen
 * areas it matches. "I want to feel confident presenting" lands on confidence
 * even if money was tapped first.
 *
 * Only ever returns an area they selected. This narrows an existing choice; it
 * does not invent one, so it can't file someone's desire under something they
 * explicitly didn't pick.
 *
 * Deliberately a keyword match rather than a model call. It runs during
 * onboarding, where an extra second of latency costs more than the occasional
 * imperfect guess, and the fallback is exactly the old behaviour.
 */

/**
 * Words that indicate a category, beyond its own id and label.
 *
 * Kept small and concrete on purpose — a long list of vague words matches
 * everything and is worse than no match at all.
 */
const HINTS: Record<string, string[]> = {
  "self-love": ["love myself", "self worth", "worthy", "kind to myself", "enough", "gentle"],
  confidence: ["confident", "confidence", "nervous", "anxious", "speak up", "believe in myself", "shy"],
  career: ["job", "career", "promotion", "work", "boss", "interview", "role", "manager"],
  abundance: ["abundance", "abundant", "plenty", "enough money", "prosperity"],
  money: ["money", "rich", "wealth", "salary", "income", "debt", "savings", "earn", "rent", "bills"],
  success: ["success", "successful", "win", "achieve", "goal", "ambition"],
  "dream-job": ["dream job", "offer", "hired", "new job", "apply", "recruiter"],
  business: ["business", "company", "startup", "clients", "customers", "founder", "launch"],
  "dream-home": ["house", "home", "flat", "apartment", "move", "mortgage", "rent a place"],
  peace: ["peace", "calm", "stress", "overwhelmed", "quiet", "rest", "burnout"],
  relationships: ["relationship", "partner", "love", "marriage", "friends", "family", "lonely"],
  health: ["health", "fit", "fitness", "weight", "strong", "sleep", "body", "gym"],
  growth: ["grow", "growth", "better", "change", "learn", "discipline", "habit"],
};

/**
 * Pick the best-matching selected area for a sentence.
 *
 * @param selected the areas the person chose, in tap order
 * @param text     what they typed — the desire, and anything else that helps
 * @returns one of `selected`, or undefined if there is nothing to choose from
 */
export function matchCategory(selected: string[], text: string): string | undefined {
  if (selected.length === 0) return undefined;
  if (selected.length === 1) return selected[0];

  const haystack = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
  if (haystack.trim().length === 0) return selected[0];

  let best: string | undefined;
  let bestScore = 0;

  for (const area of selected) {
    const terms = [area.replace(/-/g, " "), ...(HINTS[area] ?? [])];
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(` ${term} `) || haystack.includes(` ${term}`)) {
        // Longer phrases are more specific than single words: "dream job"
        // should beat "job" when both are present.
        score = Math.max(score, term.split(" ").length * 10 + term.length);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = area;
    }
  }

  // No match means no evidence either way, so keep the old behaviour rather
  // than guessing: the first thing they tapped.
  return best ?? selected[0];
}
