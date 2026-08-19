/**
 * Progress for a desire, kept when the milestone templates were deleted.
 *
 * This lived in compose-milestones.ts alongside the five canned steps. Those
 * are gone — milestones are written by the model now or not at all — but
 * measuring progress was never template work, so it moves here rather than
 * being lost with them.
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
