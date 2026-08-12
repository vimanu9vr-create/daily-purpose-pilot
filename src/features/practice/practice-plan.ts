/**
 * Works out what today's practice actually consists of.
 *
 * The blueprint describes seven steps and five minutes. Both of those are
 * wrong as a fixed rule, for the same reason the sleep tracks were wrong: a
 * number written once and then applied to everybody. Someone who chose two
 * minutes and only likes journaling should not be handed a breathing exercise,
 * a visualisation and a gratitude prompt — they'll do it twice and stop.
 *
 * So the session is assembled rather than hardcoded:
 *
 *   The time budget decides how many steps fit.
 *   The chosen styles decide which steps are eligible.
 *   Two steps are always present regardless — the intention that opens it and
 *   the action that closes it. Those are the product. Everything between them
 *   is the part that makes it pleasant.
 *
 * The action step is last on purpose. It's the one thing being asked of the
 * person, and asking after four minutes of calm gets a very different answer
 * than asking cold.
 */

export type StepId =
  "breathe" | "intention" | "affirmation" | "visualize" | "journal" | "gratitude" | "action";

export type PracticeStyle =
  "writing" | "visualization" | "affirmations" | "meditation" | "gratitude" | "action";

export type Step = {
  id: StepId;
  label: string;
  /** Roughly how long this step wants, in seconds. */
  seconds: number;
  /** Styles that make this step wanted. Empty means always eligible. */
  styles: PracticeStyle[];
};

/** In the order they'd appear if every one of them were included. */
const ALL_STEPS: Step[] = [
  { id: "breathe", label: "Breathe", seconds: 30, styles: ["meditation"] },
  { id: "intention", label: "Your intention", seconds: 30, styles: [] },
  { id: "affirmation", label: "Affirmation", seconds: 45, styles: ["affirmations"] },
  { id: "visualize", label: "Visualise", seconds: 120, styles: ["visualization"] },
  { id: "journal", label: "Write", seconds: 90, styles: ["writing"] },
  { id: "gratitude", label: "Gratitude", seconds: 60, styles: ["gratitude"] },
  { id: "action", label: "Today's action", seconds: 30, styles: [] },
];

/** Always present. The intention frames it; the action is the point of it. */
const MANDATORY: StepId[] = ["intention", "action"];

export type PracticePlan = {
  steps: Step[];
  totalSeconds: number;
};

/**
 * Builds today's session.
 *
 * @param minutes  What they picked in onboarding: 2, 5, 10 or 15.
 * @param styles   How they said they like to practise. Empty means no
 *                 preference, which we read as "all of it" rather than
 *                 "none of it" — a blank answer shouldn't produce a bare
 *                 session.
 */
export function buildPracticePlan(minutes: number, styles: PracticeStyle[]): PracticePlan {
  const budget = Math.max(60, minutes * 60);
  const wanted = new Set<PracticeStyle>(
    styles.length > 0
      ? styles
      : ["writing", "visualization", "affirmations", "meditation", "gratitude", "action"],
  );

  const mandatory = ALL_STEPS.filter((step) => MANDATORY.includes(step.id));
  const optional = ALL_STEPS.filter(
    (step) => !MANDATORY.includes(step.id) && step.styles.some((style) => wanted.has(style)),
  );

  // Mandatory steps are paid for first, so they can never be squeezed out by
  // a short budget. At two minutes this leaves 60 seconds to spend.
  let remaining = budget - mandatory.reduce((sum, step) => sum + step.seconds, 0);

  const chosen: Step[] = [];
  for (const step of optional) {
    if (step.seconds > remaining) continue;
    chosen.push(step);
    remaining -= step.seconds;
  }

  // Restore the canonical order rather than the order they were selected in,
  // so a session always reads breathe → intention → … → action.
  const included = new Set([...mandatory, ...chosen].map((step) => step.id));
  const steps = ALL_STEPS.filter((step) => included.has(step.id));

  return {
    steps,
    totalSeconds: steps.reduce((sum, step) => sum + step.seconds, 0),
  };
}

/**
 * Spreads any leftover time across the steps that benefit from it.
 *
 * Without this, choosing fifteen minutes gives the same session as choosing
 * ten and simply ends early — which would make the longer option feel like a
 * lie. Breathing and visualising stretch well; reading an affirmation does
 * not, so it's left alone.
 */
export function stretchToBudget(plan: PracticePlan, minutes: number): PracticePlan {
  const budget = minutes * 60;
  const spare = budget - plan.totalSeconds;
  if (spare <= 0) return plan;

  const stretchable = plan.steps.filter((step) =>
    ["breathe", "visualize", "journal"].includes(step.id),
  );
  if (stretchable.length === 0) return plan;

  const share = Math.floor(spare / stretchable.length);
  const steps = plan.steps.map((step) =>
    stretchable.some((s) => s.id === step.id) ? { ...step, seconds: step.seconds + share } : step,
  );

  return { steps, totalSeconds: steps.reduce((sum, step) => sum + step.seconds, 0) };
}

/** Everything the onboarding question offers, in the order it's shown. */
export const PRACTICE_STYLES: { id: PracticeStyle; label: string }[] = [
  { id: "writing", label: "Writing" },
  { id: "visualization", label: "Visualising" },
  { id: "affirmations", label: "Affirmations" },
  { id: "meditation", label: "Meditation" },
  { id: "gratitude", label: "Gratitude" },
  { id: "action", label: "Action planning" },
];

export const PRACTICE_LENGTHS = [2, 5, 10, 15] as const;

export const PRACTICE_TIMES = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
] as const;
