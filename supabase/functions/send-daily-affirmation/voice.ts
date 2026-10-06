/**
 * What the morning notification actually says.
 *
 * ## The problem this fixes
 *
 * The content varied — a programme intention, or an affirmation rotated by
 * `last_shown_at` — but the WORDING never did. Every morning opened with
 * "Your day 3 practice is ready" or "Vicky, your 5 minutes are ready". After
 * a week that is wallpaper: the eye recognises the shape and swipes before
 * reading. A notification that is dismissed unread is worse than none,
 * because it teaches the person to dismiss the next one too.
 *
 * So the wording rotates as well, and it rotates deterministically on the day
 * number rather than randomly — random repeats by chance, and the one thing
 * this must never do is land the same line twice running.
 *
 * ## The voice
 *
 * Viggnesh's examples set it: slightly mystical, quietly urgent, and it
 * assumes the reader already believes. "What is mathematically yours cannot
 * be given to anyone else" is the register — a claim stated as fact, not a
 * reminder to open an app.
 *
 * Two rules it must not break.
 *
 * NO OUTCOME PROMISES. "Your money arrives today" is a claim about the world
 * that we cannot make and that app stores remove apps for. Everything here is
 * about attention, rehearsal and consistency — the things the practice
 * actually does.
 *
 * NO BRAND PREFIX. Viggnesh's drafts start "ManifestAnything:" but Android and
 * iOS already print the app name above every notification. Repeating it wastes
 * the first third of a line that gets truncated at about forty characters.
 */

export type Signals = {
  firstName?: string | undefined;
  /** Consecutive days practised. 0 when the streak has just broken. */
  streak?: number | undefined;
  /** Days since they last opened the app. 0 means today. */
  daysAway?: number | undefined;
  /** Their own words for what they want, when we have them. */
  desire?: string | undefined;
  /** Programme day number, when one is being sent. */
  dayNumber?: number | undefined;
};

type Line = { title: string; body: string };

/**
 * Lines for someone who is showing up. Celebratory, short, no pressure — a
 * person mid-streak needs acknowledgement, not persuasion.
 */
const ON_TRACK: ((s: Signals) => Line)[] = [
  (s) => ({
    title: s.firstName ? `${s.firstName}, your five minutes` : "Your five minutes",
    body: "The same five you did yesterday. That is the whole trick.",
  }),
  (s) => ({
    title: s.firstName ? `${s.firstName}, your window is open` : "Your window is open",
    body: "What is mathematically yours cannot be given to anyone else.",
  }),
  () => ({
    title: "Your energy check-in is ready",
    body: "Don't carry yesterday into today. Tap to realign.",
  }),
  () => ({
    title: "Today's rehearsal",
    body: "You notice what you rehearsed recently. That is the entire mechanism.",
  }),
];

/**
 * Lines for someone who has stopped. These are the hardest to get right —
 * guilt is the obvious lever and the wrong one, because the feeling it
 * produces is avoidance, and avoidance is what they are already doing.
 * Every line here makes returning cheap rather than making leaving expensive.
 */
const RETURNING: ((s: Signals) => Line)[] = [
  () => ({
    title: "It kept your place",
    body: "Nothing expired. Five minutes picks up exactly where you stopped.",
  }),
  (s) => ({
    title: s.desire ? `Still yours: ${trim(s.desire)}` : "Still yours",
    body: "A missed week doesn't move it. Come back for five minutes.",
  }),
  () => ({
    title: "The streak is not the point",
    body: "The practice is. Start a new one this morning — it costs five minutes.",
  }),
];

/** Lines for the programme, which has its own day and its own intention. */
const PROGRAMME: ((s: Signals) => Line)[] = [
  (s) => ({ title: `Day ${s.dayNumber} is ready`, body: "" }),
  (s) => ({ title: `Day ${s.dayNumber} — five minutes`, body: "" }),
  (s) => ({
    title: s.firstName ? `${s.firstName}, day ${s.dayNumber}` : `Day ${s.dayNumber}`,
    body: "",
  }),
];

function trim(text: string, max = 32): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Pick the line for today.
 *
 * `rotation` should be something that increments once per day and is stable
 * within the day — the programme day number, or days-since-signup. Passing a
 * random number would work most of the time and occasionally repeat, which is
 * the single failure this file exists to prevent.
 */
export function phrase(signals: Signals, rotation: number, body: string): Line {
  const away = signals.daysAway ?? 0;
  const set = away >= 3 ? RETURNING : signals.dayNumber !== undefined ? PROGRAMME : ON_TRACK;
  const line = set[Math.abs(rotation) % set.length]!(signals);
  // The caller's body wins when there is one — it carries the actual
  // intention or affirmation, which is the thing worth reading. These lines
  // only supply a body when there would otherwise be none.
  return { title: line.title, body: body.trim() || line.body };
}
