/**
 * What the evening notification says.
 *
 * Split out of index.ts for the same reason the morning's voice.ts exists: so
 * the wording can be tested, and so changing a line does not mean editing the
 * function that talks to the push service.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT THE MORNING NOTIFICATION
 * ---------------------------------------------------------------------------
 *
 * The morning push has a job: start the practice. It can name what is ready,
 * because something is.
 *
 * The evening has a different one, and getting them confused is how a wind-down
 * nudge turns into a second to-do item at 21:00. Three rules follow from that,
 * and every line below obeys them:
 *
 *   1. NEVER MENTION THE MORNING. This arrives at night. Whether they practised
 *      today is none of its business, and a line that references it becomes a
 *      scold on precisely the day it most needs not to be — the one where they
 *      didn't. The gratitude ritual has to stand on its own or it is just an
 *      audit of the first one.
 *
 *   2. NO STREAKS, NO COUNTS, NO URGENCY. Nothing that turns winding down into
 *      a performance. No exclamation marks, no "Don't forget". A nudge that
 *      sounds like a task is a nudge people switch off.
 *
 *   3. ASK A SMALLER QUESTION THAN YOU WANT ANSWERED. "What are you grateful
 *      for?" is hard on a bad day. "What are three things?" is answerable, and
 *      the bad day is the one that matters — it is the whole reason the feature
 *      exists.
 *
 * ---------------------------------------------------------------------------
 * WHY A ROTATION AT ALL
 * ---------------------------------------------------------------------------
 *
 * The evening push used to be one hardcoded string, sent every night forever.
 * A line you have read sixty times is not a line any more, it is furniture —
 * and a notification that stops being read is worse than none, because it
 * spends permission you cannot easily get back.
 *
 * The rotation is deterministic on the local date, not random: random repeats
 * on consecutive nights roughly one time in seven, which is the single failure
 * that would make this look broken.
 */

export type EveningSignals = {
  /** First name, when we have one worth using. */
  firstName?: string | undefined;
};

export type Line = { title: string; body: string };

/**
 * Seven lines, one for each day of the week in effect.
 *
 * They vary the angle rather than the ask: looking back, noticing something
 * small, closing the day. Every one of them has to work on an ordinary
 * Wednesday AND on a day that went badly, because this fires regardless.
 */
const LINES: ((s: EveningSignals) => Line)[] = [
  (s) => ({
    title: s.firstName ? `${s.firstName}, three things` : "Three things",
    body: "What went right today? Two minutes before you sleep.",
  }),
  () => ({
    title: "Before the day closes",
    body: "Three things that went right. They are allowed to be small.",
  }),
  () => ({
    title: "Three small ones",
    body: "Not the highlights. The ordinary things you would forget by Friday.",
  }),
  (s) => ({
    title: s.firstName ? `${s.firstName}, what held up today?` : "What held up today?",
    body: "Name three. Two minutes, then put the phone down.",
  }),
  () => ({
    title: "The quiet part of the day",
    body: "Three things worth keeping. Even on a day that wasn't much.",
  }),
  () => ({
    title: "Three things, then sleep",
    body: "Noticing them is the practice. Writing them is what makes it stick.",
  }),
  () => ({
    title: "Anything go right?",
    body: "Three, however small. A bad day usually still has three.",
  }),
];

/**
 * Pick tonight's line.
 *
 * `localDate` is the user's own date — `sent_for` from the claim — so the
 * rotation advances once per night in their timezone rather than at UTC
 * midnight, which for some users would land mid-evening and change the line
 * halfway through the window.
 */
export function eveningPhrase(signals: EveningSignals, localDate: string): Line {
  return LINES[dayIndex(localDate) % LINES.length]!(signals);
}

/**
 * Days since the epoch for a YYYY-MM-DD string.
 *
 * Parsed by hand rather than with `new Date(localDate)`: that would read the
 * string as UTC midnight and then the runtime's own timezone could shift it
 * across a day boundary, which is exactly the bug this function is here to
 * avoid. Three integers cannot drift.
 */
export function dayIndex(localDate: string): number {
  const [y, m, d] = localDate.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
