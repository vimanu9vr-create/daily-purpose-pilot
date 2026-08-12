/**
 * Achievements, kept deliberately quiet.
 *
 * These are derived, never stored. There's no `achievements` table and no
 * unlock event, because the moment you store them you need a job to award
 * them, a notification to announce them, and a decision about what happens
 * when someone deletes the data underneath one. Computing from the counts you
 * already have costs a millisecond and can't drift out of sync with reality.
 *
 * The tone rule: every one of these describes something the person did, in
 * plain past tense. No "Legendary", no "Master", no levels. An app that hands
 * out grand titles for four minutes of breathing is telling you it thinks
 * you're a child, and the people most likely to need this app are the least
 * likely to enjoy being patronised.
 *
 * There is deliberately no achievement for a long streak beyond a week.
 * Rewarding a 100-day streak creates something to lose, and the fear of losing
 * it is what turns a practice into an obligation — the exact failure mode the
 * blueprint asked to avoid.
 */

export type AchievementId =
  | "first_practice"
  | "first_action"
  | "week_of_practice"
  | "ten_actions"
  | "thirty_practices"
  | "first_milestone"
  | "goal_complete"
  | "ten_entries"
  | "first_board";

export type Achievement = {
  id: AchievementId;
  title: string;
  /** What earned it, in plain language. Shown whether or not it's unlocked. */
  detail: string;
  earned: boolean;
  /** 0–1, for the ones that are a count. Null when it's a one-off. */
  progress: number | null;
};

export type AchievementInput = {
  practices: number;
  practiceDays: number;
  actionsCompleted: number;
  milestonesCompleted: number;
  goalsCompleted: number;
  journalEntries: number;
  boards: number;
  longestStreak: number;
};

function ratio(done: number, target: number): number {
  return Math.min(1, Math.max(0, done / target));
}

export function computeAchievements(input: AchievementInput): Achievement[] {
  return [
    {
      id: "first_practice",
      title: "First practice",
      detail: "You sat down and did one.",
      earned: input.practices >= 1,
      progress: null,
    },
    {
      id: "first_action",
      title: "First action",
      detail: "You finished something in the real world.",
      earned: input.actionsCompleted >= 1,
      progress: null,
    },
    {
      id: "week_of_practice",
      title: "Seven days",
      detail: "A week of showing up in a row.",
      earned: input.longestStreak >= 7,
      progress: ratio(input.longestStreak, 7),
    },
    {
      id: "ten_actions",
      title: "Ten actions done",
      detail: "Ten real things, not ten intentions.",
      earned: input.actionsCompleted >= 10,
      progress: ratio(input.actionsCompleted, 10),
    },
    {
      id: "thirty_practices",
      title: "Thirty practices",
      detail: "Long enough that it isn't a phase.",
      earned: input.practices >= 30,
      progress: ratio(input.practices, 30),
    },
    {
      id: "first_milestone",
      title: "First step done",
      detail: "One part of a plan, actually finished.",
      earned: input.milestonesCompleted >= 1,
      progress: null,
    },
    {
      id: "goal_complete",
      title: "Something finished",
      detail: "Every step of one desire, complete.",
      earned: input.goalsCompleted >= 1,
      progress: null,
    },
    {
      id: "ten_entries",
      title: "Ten entries",
      detail: "Enough writing to look back on and notice a pattern.",
      earned: input.journalEntries >= 10,
      progress: ratio(input.journalEntries, 10),
    },
    {
      id: "first_board",
      title: "First board",
      detail: "You put what you want somewhere you'd see it.",
      earned: input.boards >= 1,
      progress: null,
    },
  ];
}

/**
 * What to say about a missed day.
 *
 * Never "you broke your streak", never "don't lose your progress". A streak is
 * a description of the past, not a possession that can be taken away, and
 * language that implies otherwise is how these apps make people feel worse for
 * having used them.
 */
export function streakMessage(streak: number, practisedToday: boolean): string {
  if (streak === 0) return "Welcome back. Your journey continues.";
  if (streak === 1) return practisedToday ? "That's today done." : "One day so far.";
  return `${streak} days in a row.`;
}
