/**
 * What a track plays when the narration won't come.
 *
 * ## The problem
 *
 * Narration is Voice-tier only, and it costs 20–39c a listen, so gating it is
 * correct. But the refusal currently means SILENCE: a free user opens a sleep
 * or frequency track, taps play, and nothing happens except a line of text.
 * That reads as a broken app rather than a locked feature — which is exactly
 * how "stories isn't working" got reported when the paywall was working fine.
 *
 * Silence is the worst possible paywall. It gives the person no reason to
 * upgrade, because they have heard nothing to want more of.
 *
 * ## The fix
 *
 * We already ship real audio that costs nothing per play: four tone recordings
 * and an ambient pad, bundled as static files. A frequency track can play its
 * actual tone — the 528 Hz file really is 528 Hz — and a sleep or meditation
 * track can play the pad. Both work offline, neither touches ElevenLabs, and
 * neither can run out of credit.
 *
 * So a locked track is no longer silent. It plays the bed and says the words
 * are on the Voice plan. The free tier becomes a demo instead of a wall, and
 * the gap between "nice ambient sound" and "someone reading this to you" is
 * the upgrade argument, made by the product rather than by a banner.
 *
 * ## Why this is a separate file
 *
 * The rule is small but it has four inputs and three outcomes, and getting it
 * wrong is silent — literally. A pure function can be tested without a browser,
 * an AudioContext, or a subscription.
 */

import { frequencyFromTitle, hasToneFile } from "@/lib/ambient-audio";

/** Why narration isn't playing. Mirrors the flags `useStudioNarration` sets. */
export type NarrationBlock =
  | "none"
  /** Narration isn't part of this plan. Upgrading fixes it. */
  | "needs-voice-plan"
  /** Today's allowance is spent. Tomorrow fixes it. */
  | "daily-limit"
  /** Our problem — no credit, bad key, upstream down. Nothing they can do. */
  | "unavailable";

export type FreeAudio =
  /** Play the real tone for this frequency, with the pad underneath. */
  | { kind: "tone"; frequencyHz: number }
  /** Play the ambient bed alone. */
  | { kind: "pad" }
  /** Play nothing — the narration itself is coming or already playing. */
  | { kind: "none" };

/**
 * Tracks that have a sound bed of their own worth playing. A written story has
 * no ambient identity — playing a pad under a refused story would be inventing
 * a feature rather than previewing one.
 */
const BEDDED_KINDS = new Set(["sleep", "meditation", "frequency"]);

export type Decision = {
  /** The track's `kind` column: sleep, meditation, frequency, story… */
  kind: string | null | undefined;
  /** The track's title, which is where the frequency lives ("Renewal 528 Hz"). */
  title: string | null | undefined;
  /** Why narration isn't available, if it isn't. */
  block: NarrationBlock;
  /** True once real narration audio exists — it always wins. */
  hasNarration: boolean;
};

/**
 * Decide what to play.
 *
 * Narration always wins when it exists: the bed is a substitute for silence,
 * not a layer under the voice. The voice already ships with its own pad.
 */
export function freeAudioFor({ kind, title, block, hasNarration }: Decision): FreeAudio {
  // Real narration, or narration on its way, needs no substitute.
  if (hasNarration || block === "none") return { kind: "none" };

  // A written story has no bed of its own. Don't invent one.
  if (!kind || !BEDDED_KINDS.has(kind)) return { kind: "none" };

  /**
   * A frequency track plays its actual frequency, which is the entire point of
   * the track. Falling back to the pad here would be substituting the one
   * element the person came for.
   *
   * But only when we actually ship that recording. `hasToneFile` is the guard:
   * without it, a title like "Drift 432 Hz" parses fine, we claim the tone is
   * playing, and `ToneGenerator` quietly plays the pad instead — so the caption
   * tells the listener they are hearing a frequency they are not.
   */
  const hz = title ? frequencyFromTitle(title) : null;
  if (kind === "frequency" && hz !== null && hasToneFile(hz)) {
    return { kind: "tone", frequencyHz: hz };
  }

  return { kind: "pad" };
}

/**
 * The line shown under the play button while the bed is playing.
 *
 * Written so each one points at the single thing that resolves it. The
 * distinction matters: telling a Standard subscriber to come back tomorrow
 * sends them back to find nothing has changed, and telling someone our
 * ElevenLabs balance is empty is not their problem to solve.
 */
export function freeAudioCaption(block: NarrationBlock, playing: FreeAudio): string | null {
  if (playing.kind === "none") return null;

  const bed =
    playing.kind === "tone" ? `The ${playing.frequencyHz} Hz tone is playing` : "The sound bed is playing";

  switch (block) {
    case "needs-voice-plan":
      return `${bed}. The spoken version is part of the Voice plan.`;
    case "daily-limit":
      return `${bed}. That's today's narration — the voice is back tomorrow.`;
    case "unavailable":
      return `${bed}. The voice is unavailable right now — that one's on us.`;
    default:
      return null;
  }
}
