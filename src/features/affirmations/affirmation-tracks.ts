/**
 * Affirmations as tracks you press play on, rather than text you read.
 *
 * In Stella an affirmation is a photograph with a title and "10 MIN" and a
 * play button. In this app it was a sentence on a card. Same content,
 * completely different product — one is something you *do* with your eyes shut
 * on the bus, the other is something you glance at.
 *
 * ## The label has to describe the audio
 *
 * Reported: "in affirmations it shows 10 mins but wordings is less and it
 * keeps repeating the same thing still 10 mins." Exactly right, and it was two
 * mistakes compounding.
 *
 * The script held twelve lines — about two minutes of speech. The label came
 * from a hardcoded `minutes` on the theme, which nothing checked against the
 * words. And the player, having run out of audio after two minutes, looped the
 * same two minutes five more times to fill the ten it had promised. So the
 * number was invented, and the loop was covering for the number.
 *
 * Both are now derived from the actual lines:
 *
 *   - The length is CALCULATED from how long the words take to say at the
 *     speed Sarah reads them, plus the silence between. If there are only
 *     enough lines for five minutes, it says five minutes.
 *   - The repetition is BAKED INTO the script rather than left to the player,
 *     so the audio genuinely lasts as long as the label and the passes are a
 *     deliberate three rather than however many the clock needed.
 *
 * Repetition itself is not the problem — it is the mechanism, and every real
 * affirmation track uses it. Hearing a line once is a sentence; hearing it
 * three times across ten minutes is a practice. What was wrong was repeating
 * *four* lines *nine* times because there was nothing else to play.
 */

export type AffirmationTrackSeed = {
  /** What this set is about — becomes the title. */
  theme: string;
  /** The affirmations themselves, in the user's own language where possible. */
  lines: string[];
  category: string;
};

/**
 * How long one line takes, start to start.
 *
 * Sarah reads at roughly 150 words a minute, and `speed: 0.7` in the narration
 * function takes that to about 105 — call it 1.75 words a second. An
 * affirmation runs 8 to 16 words, so a typical line is around seven seconds of
 * speech. The 2.4 second gap after it is silence the narration function adds
 * between every sentence.
 *
 * These two numbers live in `narrate-story/index.ts`. If they change there and
 * not here, every duration in the app becomes a lie again — which is precisely
 * the bug this replaces.
 */
const WORDS_PER_SECOND = 1.75;
const GAP_SECONDS = 2.4;

/**
 * How many times the set is heard.
 *
 * Three is the number real affirmation audio settles on: enough for a line to
 * stop being new and start being familiar, not so many that you notice the
 * loop. Fixed rather than derived, because deriving it from a target length is
 * what produced nine passes of four lines.
 */
export const PASSES = 3;

/** How long a set of lines actually runs, in seconds. Honest by construction. */
export function trackSeconds(lines: string[], passes = PASSES): number {
  const spoken = lines.reduce((total, line) => {
    const words = line.split(/\s+/).filter(Boolean).length;
    return total + words / WORDS_PER_SECOND + GAP_SECONDS;
  }, 0);

  // The opening and the close are said once, not once per pass.
  const framing = 4 * (1 / WORDS_PER_SECOND) * 8 + GAP_SECONDS * 4;
  return Math.round(spoken * passes + framing);
}

/** The label, rounded down so it never promises more than it plays. */
export function trackMinutes(lines: string[], passes = PASSES): number {
  return Math.max(1, Math.floor(trackSeconds(lines, passes) / 60));
}

/**
 * How many distinct lines a stated length needs.
 *
 * The inverse of the above, for deciding how much material to gather before
 * building a track of a given size.
 */
export function linesNeededFor(minutes: number, passes = PASSES): number {
  const secondsPerLine = 12 / WORDS_PER_SECOND + GAP_SECONDS;
  return Math.ceil((minutes * 60) / (secondsPerLine * passes));
}

/**
 * Builds the spoken script.
 *
 * The passes are written into the text, so the mp3 itself is the full track.
 * That used to be unaffordable — one generation of a ten-minute script meant a
 * thirty-second wait before anything played. It is affordable now because
 * narration is split: the opening two sentences are generated on their own and
 * start playing in a few seconds while the rest renders underneath.
 *
 * Each pass is introduced differently. Without that, the second and third
 * passes are audibly a tape rewinding; with it, they read as a practice
 * returning to the same ground on purpose.
 */
export function buildTrackScript(seed: AffirmationTrackSeed, passes = PASSES): string {
  const opening = [
    "Settle where you are.",
    "There's nothing to get right here. Just listen, and let these land where they land.",
  ];

  const bridges = ["Again, slower.", "Once more. Let them be ordinary."];

  const body: string[] = [];
  for (let pass = 0; pass < passes; pass += 1) {
    if (pass > 0) body.push(bridges[(pass - 1) % bridges.length]!);
    body.push(...seed.lines);
  }

  return [...opening, ...body, "Stay here as long as you like."].join("\n\n");
}

/**
 * The themes a personal affirmation library is built from.
 *
 * No `minutes` any more. It used to be declared here and the audio was
 * expected to match, which it never did. The length now comes from the lines,
 * so a theme only says what it's about.
 */
export const TRACK_THEMES: { id: string; title: string; category: string }[] = [
  { id: "money", title: "Money, without the knot in your stomach", category: "money" },
  { id: "success", title: "The person who finishes things", category: "success" },
  { id: "confidence", title: "Walking in like you belong", category: "confidence" },
  { id: "self-love", title: "Speaking to yourself kindly", category: "self-love" },
  { id: "dream-job", title: "The work you actually want", category: "dream-job" },
  { id: "business", title: "Building the thing", category: "business" },
  { id: "abundance", title: "Enough, and then more", category: "abundance" },
  { id: "peace", title: "A quieter mind", category: "peace" },
  { id: "relationships", title: "Being close to people", category: "relationships" },
  { id: "dream-home", title: "Somewhere that's yours", category: "dream-home" },
  { id: "health", title: "In your own body", category: "health" },
  { id: "growth", title: "Becoming, not arriving", category: "growth" },
];
