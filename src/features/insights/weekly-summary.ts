/**
 * The weekly report.
 *
 * The honesty rule here matters more than the arithmetic. A weekly summary is
 * the first place an app is tempted to flatter — "amazing week!" over two
 * sessions — and flattery is how you teach someone their data is decorative.
 * Once they know the numbers don't mean anything, the numbers stop working.
 *
 * So: the counts are counts, the sentence describing them is chosen from what
 * actually happened, and a quiet week gets a sentence that says so without
 * making it a moral failing. "Two sessions" is a fact. "Only two sessions" is
 * a judgement, and "amazing week!" is a lie.
 */

export type WeeklyInput = {
  practiceDays: string[];
  practiceSeconds: number;
  journalEntries: number;
  actionsCompleted: number;
  actionsOffered: number;
  milestonesCompleted: number;
  /** Desire titles touched by a completed action, most frequent first. */
  focusAreas: string[];
};

export type WeeklySummary = {
  practices: number;
  minutes: number;
  journalEntries: number;
  actionsCompleted: number;
  milestonesCompleted: number;
  /** One honest sentence about the week. */
  reflection: string;
  /** One concrete suggestion, or null when there's nothing worth saying. */
  suggestion: string | null;
};

export function summariseWeek(input: WeeklyInput): WeeklySummary {
  const practices = input.practiceDays.length;
  const minutes = Math.round(input.practiceSeconds / 60);

  return {
    practices,
    minutes,
    journalEntries: input.journalEntries,
    actionsCompleted: input.actionsCompleted,
    milestonesCompleted: input.milestonesCompleted,
    reflection: reflect(input, practices),
    suggestion: suggest(input, practices),
  };
}

function reflect(input: WeeklyInput, practices: number): string {
  if (practices === 0 && input.actionsCompleted === 0) {
    return "Nothing logged this week. That happens, and the app will be here on the day it doesn't.";
  }

  if (practices === 0) {
    return `No sessions this week, but you finished ${count(input.actionsCompleted, "action")}. The doing is the part that matters most.`;
  }

  const focus = input.focusAreas[0];

  if (practices >= 5) {
    return focus
      ? `Five or more sessions, mostly around ${focus.toLowerCase()}. This is what consistency actually looks like — unremarkable and repeated.`
      : "Five or more sessions this week. This is what consistency actually looks like — unremarkable and repeated.";
  }

  if (input.actionsCompleted > practices) {
    return `More actions finished than sessions run. You're spending your time on the doing rather than the preparing, which is the right way round.`;
  }

  return focus
    ? `${capitalise(count(practices, "session"))}, mostly around ${focus.toLowerCase()}.`
    : `${capitalise(count(practices, "session"))} this week.`;
}

function suggest(input: WeeklyInput, practices: number): string | null {
  // Nothing to say to someone who did nothing. A prompt here reads as nagging,
  // and nagging is what gets an app deleted rather than opened.
  if (practices === 0 && input.actionsCompleted === 0) return null;

  if (input.actionsOffered > 0 && input.actionsCompleted === 0) {
    return "You ran sessions but didn't finish an action. Try picking the smallest one and doing it before you close the app.";
  }

  if (practices >= 4 && input.milestonesCompleted === 0) {
    return "Plenty of daily work, no milestones ticked. Worth checking whether your steps are still the right ones.";
  }

  if (input.journalEntries === 0 && practices > 0) {
    return "You haven't written anything this week. One sentence after a session is usually enough to notice a pattern later.";
  }

  if (practices > 0 && practices < 3) {
    return "Two or three days a week is a real habit. Picking the same time each day is what makes it stick, more than motivation does.";
  }

  return null;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Monday of the week containing `date`, in local time. */
export function startOfWeek(date = new Date()): Date {
  const start = new Date(date);
  // getDay() is 0 for Sunday, and weeks here start on Monday.
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** The four questions of the Sunday review, in order. */
export const REVIEW_QUESTIONS = [
  { id: "went_well", label: "What went well?" },
  { id: "learned", label: "What did you learn?" },
  { id: "grateful", label: "What are you grateful for?" },
  { id: "next", label: "What do you want to focus on next week?" },
] as const;
