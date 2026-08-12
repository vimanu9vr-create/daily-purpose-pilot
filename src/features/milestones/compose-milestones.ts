/**
 * Breaks a desire into steps, on the device.
 *
 * The shape matters more than the wording. Every set follows the same arc —
 * understand where you are, decide what you're aiming at, do the smallest real
 * thing, make it repeatable, then the part that only makes sense once you've
 * started. That arc is what turns "financial freedom" from a mood into a
 * sequence, and it's roughly what a good coach would ask for in the first
 * conversation.
 *
 * These are starting points, not a plan. Every one is editable and deletable,
 * because a generated list that can't be changed is just a nicer-looking way
 * of telling someone they're doing it wrong.
 */

export type MilestoneSeed = {
  title: string;
  category?: string | null;
  why?: string | null;
};

const BY_CATEGORY: Record<string, string[]> = {
  wealth: [
    "Work out exactly what comes in and goes out each month",
    "Decide what number would actually count as enough",
    "Cut or cancel one recurring cost",
    "Set up one automatic transfer, however small",
    "Find one way to earn more that doesn't cost you evenings",
  ],
  career: [
    "Write down what you want the next role to give you",
    "Get your CV honest and current",
    "Talk to three people already doing it",
    "Close the one skill gap that keeps coming up",
    "Apply, or ask, for something you're not quite ready for",
  ],
  business: [
    "Name the person you're solving a problem for",
    "Talk to five of them without pitching anything",
    "Build the smallest version someone could use",
    "Put it in front of one real user",
    "Charge someone for it",
  ],
  health: [
    "Notice what you're actually doing now, without changing it",
    "Pick one thing to change, and only one",
    "Do it for a week at a size you can't fail at",
    "Make the environment easier than the willpower",
    "Add the second thing, once the first is boring",
  ],
  relationships: [
    "Name what you actually want more of",
    "Reach out to one person this week",
    "Say the thing you've been not saying",
    "Make it recurring rather than occasional",
    "Notice what you're bringing, not just receiving",
  ],
  learning: [
    "Decide what you want to be able to do, not know",
    "Pick one source and ignore the rest for now",
    "Practise before you feel ready",
    "Build something small with it",
    "Teach it to someone",
  ],
  creativity: [
    "Make one thing badly, all the way to the end",
    "Work out what you're actually drawn to",
    "Set a schedule you'd keep on a bad week",
    "Show it to one person",
    "Finish something you'd put your name on",
  ],
  wellbeing: [
    "Name what's draining you, specifically",
    "Remove or reduce one of those things",
    "Build in something restorative that isn't your phone",
    "Say no once, and sit with the discomfort",
    "Notice what's already better",
  ],
};

const UNIVERSAL = [
  "Write down where you are with this right now, honestly",
  "Decide what 'done' would actually look like",
  "Do the smallest real step this week",
  "Make it repeatable rather than heroic",
  "Review what's working and drop what isn't",
];

/** Five steps for a desire. Editable afterwards — these are a starting point. */
export function composeMilestones(seed: MilestoneSeed): string[] {
  const key = seed.category?.trim().toLowerCase() ?? "";
  return [...(BY_CATEGORY[key] ?? UNIVERSAL)];
}

/**
 * Progress for a desire: the share of its milestones and actions completed.
 *
 * Both count, and deliberately so. Milestones alone would leave someone at 0%
 * for weeks while genuinely working; daily actions alone would let someone hit
 * 100% by ticking small things forever without moving. Together, the number
 * means "you are doing the work and getting through the plan".
 *
 * Returns null rather than 0 when there's nothing to measure, so the UI can
 * say nothing instead of showing a discouraging empty bar on day one.
 */
export function computeProgress({
  milestonesTotal,
  milestonesDone,
  actionsTotal,
  actionsDone,
}: {
  milestonesTotal: number;
  milestonesDone: number;
  actionsTotal: number;
  actionsDone: number;
}): number | null {
  if (milestonesTotal === 0 && actionsTotal === 0) return null;

  // Clamped, because the inputs are counts from two different queries and
  // nothing guarantees they agree. A deleted milestone or a stale cache can
  // leave "done" higher than "total", and an uncorrected ratio then produced
  // 108% — a progress bar past the end of its track, which reads as a bug to
  // the user and is one.
  const share = (done: number, total: number) =>
    total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;

  // Milestones are the plan and weigh more; actions are the evidence of
  // showing up. Two thirds to one third, which stops a fortnight of small
  // ticks from claiming a goal is nearly finished.
  const milestoneShare = share(milestonesDone, milestonesTotal);
  const actionShare = share(actionsDone, actionsTotal);

  if (milestonesTotal === 0) return Math.round(actionShare * 100);
  if (actionsTotal === 0) return Math.round(milestoneShare * 100);

  return Math.round(((milestoneShare * 2 + actionShare) / 3) * 100);
}
