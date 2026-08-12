/**
 * Turns onboarding answers into a starter set of affirmations, on the device.
 *
 * The AI version is better, but this runs with no key, no cost and no network,
 * so a new user always finishes onboarding with real affirmations rather than
 * an empty screen and a spinner.
 */

import { AFFIRMATION_CATEGORIES } from "@/features/affirmations/affirmation-library";

export type OnboardingAnswers = {
  displayName: string;
  focusAreas: string[];
  desires: string;
  obstacles: string;
  desiredFeeling: string;
  tone: "warm" | "direct" | "calm";
  /** How long a daily practice should be. One of 2, 5, 10, 15. */
  practiceMinutes: number;
  /** Which kinds of practice they like. Empty means no preference. */
  practiceStyles: string[];
  /** When they want to practise, which also sets the reminder. */
  practiceTimeOfDay: "morning" | "afternoon" | "evening";
};

/** Strip trailing punctuation and lead-ins so a phrase can sit inside a sentence. */
function phrase(raw: string): string {
  return raw
    .trim()
    .replace(/^(i want to|i want|i'd like to|to)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

function lower(raw: string): string {
  const p = phrase(raw);
  // Keep an existing capital if it looks like a proper noun.
  return /^[A-Z][a-z]/.test(p) && !/^[A-Z]{2,}/.test(p)
    ? p.charAt(0).toLowerCase() + p.slice(1)
    : p;
}

const TONE_OPENERS: Record<OnboardingAnswers["tone"], string[]> = {
  warm: ["I am allowed to", "I am learning to", "I let myself"],
  direct: ["I do", "I choose to", "I am the person who will"],
  calm: ["I can", "I am at ease as I", "I move steadily toward"],
};

/**
 * Builds affirmations that use the person's actual words. Deliberately about
 * identity and action — never "this will happen for me".
 */
export function personalizedAffirmations(answers: OnboardingAnswers): string[] {
  const out: string[] = [];
  const desire = answers.desires.trim() ? lower(answers.desires) : "";
  const obstacle = answers.obstacles.trim() ? lower(answers.obstacles) : "";
  const feeling = answers.desiredFeeling.trim() ? lower(answers.desiredFeeling) : "";
  const openers = TONE_OPENERS[answers.tone];

  if (desire) {
    out.push(`I am the kind of person who works toward ${desire}.`);
    out.push(`${openers[0]} want ${desire} without apologising for it.`);
    out.push(`I take one real step toward ${desire} today, however small.`);
  }

  if (obstacle) {
    out.push(
      `${obstacle.charAt(0).toUpperCase() + obstacle.slice(1)} shows up, and I keep going anyway.`,
    );
    out.push(`I don't wait for ${obstacle} to disappear before I start.`);
  }

  if (feeling) {
    out.push(`I am building a life that feels ${feeling}.`);
    out.push(`Feeling ${feeling} follows what I do, not the other way round.`);
  }

  if (answers.displayName.trim()) {
    const name = answers.displayName.trim().split(" ")[0];
    out.push(`${name}, you are further along than you were.`);
  }

  // Round it out with library affirmations from the areas they chose.
  const fromFocus = answers.focusAreas.flatMap((areaId) => {
    const category = AFFIRMATION_CATEGORIES.find((c) => c.id === areaId);
    return category ? category.affirmations.slice(0, 3) : [];
  });

  const seen = new Set(out);
  for (const item of fromFocus) {
    if (out.length >= 14) break;
    if (!seen.has(item)) {
      out.push(item);
      seen.add(item);
    }
  }

  return out;
}

/** Which library category a personalised affirmation should be filed under. */
export function primaryCategory(answers: OnboardingAnswers): string {
  return answers.focusAreas[0] ?? "growth";
}

/** The single line the morning notification opens with. */
export function morningGreeting(displayName: string): string {
  const name = displayName.trim().split(" ")[0];
  return name ? `Morning, ${name}` : "Your affirmation for today";
}
