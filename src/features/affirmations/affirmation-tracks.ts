/**
 * Affirmations as tracks you press play on, rather than text you read.
 *
 * This is the difference the screen recording made obvious. In Stella an
 * affirmation is a photograph with a title and "10 MIN" and a play button. In
 * this app it was a sentence on a card. Same content, completely different
 * product — one is something you *do* with your eyes shut on the bus, the
 * other is something you glance at.
 *
 * The thing that makes a ten-minute affirmation track possible without ten
 * minutes of writing is repetition. Real affirmation audio is a short set of
 * lines said slowly, with silence between, cycled several times. That is not a
 * shortcut — repetition is the mechanism. Hearing "I make thoughtful decisions
 * about money" once is a sentence; hearing it nine times over ten minutes with
 * space around it is a practice.
 *
 * So one TTS generation produces a script that lasts as long as it claims,
 * because the session bed already runs for the advertised duration and brings
 * the voice back through it.
 */

export type TrackLength = 3 | 5 | 10 | 15;

export type AffirmationTrackSeed = {
  /** What this set is about — becomes the title. */
  theme: string;
  /** The affirmations themselves, in the user's own language where possible. */
  lines: string[];
  minutes: TrackLength;
  category: string;
};

/**
 * How many times the set repeats to fill the time.
 *
 * A line at this pace takes roughly six seconds to say, plus the 1.6 second
 * pause between sentences — call it eight. Twelve lines is therefore about a
 * hundred seconds per pass, so a ten-minute track wants six passes.
 *
 * Capped at eight because past that it stops feeling like a practice and
 * starts feeling like a loop someone forgot to stop.
 */
export function passesFor(minutes: TrackLength, lineCount: number): number {
  const secondsPerLine = 8;
  const perPass = Math.max(1, lineCount * secondsPerLine);
  return Math.min(8, Math.max(2, Math.round((minutes * 60) / perPass)));
}

/**
 * Builds the spoken script.
 *
 * An opening line to settle, then the set repeated, then a close. The opening
 * and close matter more than they look: they're what stop it sounding like a
 * list being read out, and they give the person somewhere to arrive.
 */
export function buildTrackScript(seed: AffirmationTrackSeed): string {
  const passes = passesFor(seed.minutes, seed.lines.length);

  const opening = [
    "Settle where you are.",
    "There's nothing to get right here. Just listen, and let these land where they land.",
  ];

  const closing = [
    "That's the set.",
    "You don't have to believe every one of these today. Saying them is how believing starts.",
  ];

  const body: string[] = [];
  for (let pass = 0; pass < passes; pass += 1) {
    // A short breath line between passes, so the repetition has a shape rather
    // than running together into one long recital.
    if (pass > 0) body.push(pass % 2 === 0 ? "Again, slower." : "Once more.");
    body.push(...seed.lines);
  }

  return [...opening, ...body, ...closing].join("\n\n");
}

/**
 * The themes a personal affirmation library is built from.
 *
 * Deliberately the areas people actually name when asked what they want, and
 * matched to the affirmation library categories so the two agree.
 */
export const TRACK_THEMES: { id: string; title: string; category: string; minutes: TrackLength }[] =
  [
    {
      id: "money",
      title: "Money, without the knot in your stomach",
      category: "money",
      minutes: 10,
    },
    { id: "success", title: "The person who finishes things", category: "success", minutes: 10 },
    { id: "confidence", title: "Walking in like you belong", category: "confidence", minutes: 5 },
    { id: "self-love", title: "Speaking to yourself kindly", category: "self-love", minutes: 10 },
    { id: "dream-job", title: "The work you actually want", category: "dream-job", minutes: 5 },
    { id: "business", title: "Building the thing", category: "business", minutes: 5 },
    { id: "abundance", title: "Enough, and then more", category: "abundance", minutes: 15 },
    { id: "peace", title: "A quieter mind", category: "peace", minutes: 15 },
    { id: "relationships", title: "Being close to people", category: "relationships", minutes: 5 },
    { id: "dream-home", title: "Somewhere that's yours", category: "dream-home", minutes: 5 },
    { id: "health", title: "In your own body", category: "health", minutes: 10 },
    { id: "growth", title: "Becoming, not arriving", category: "growth", minutes: 3 },
  ];
