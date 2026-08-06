import { useCallback, useEffect, useRef, useState } from "react";

import { ambientPad, toneGenerator, unlockAudioSession } from "@/lib/ambient-audio";

/**
 * Runs a session for its full advertised length.
 *
 * The catalogue promised things it never delivered: an 18-minute sleep track
 * whose script is 89 words — about forty seconds of speech — then silence. The
 * label came from a hand-written `minutes` field that nobody ever checked
 * against the words underneath it. Every track was wrong the same way.
 *
 * A real sleep or meditation session isn't continuous talking. It's a
 * continuous bed of sound with sparse guidance over it. So that's what this
 * does: the bed (an ambient pad, or the actual tone for a frequency session)
 * runs for the whole duration, the narration sits on top of it, and the bed
 * fades out at the end. The clock now measures the session, not the speech.
 *
 * The bed is also what makes narration stop sounding bare — speech alone over
 * silence feels like a voice memo.
 */

export type BedKind = "story" | "affirmation" | "sleep" | "meditation" | "frequency";

/** Under speech. Loud enough to feel, quiet enough to stay out of the way. */
const BED_UNDER_SPEECH = 0.09;
/** Once the voice has finished, the bed can come forward a little. */
const BED_ALONE = 0.16;
const FADE_OUT_SECONDS = 12;

export type SessionBed = {
  elapsedSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  finished: boolean;
  start: () => void;
  pause: () => void;
  stop: () => void;
  seekToRatio: (ratio: number) => void;
};

export function useSessionBed({
  kind,
  totalSeconds,
  toneHz,
  speaking,
  enabled = true,
}: {
  kind: BedKind;
  totalSeconds: number;
  /** Non-null for frequency sessions — the bed becomes the tone itself. */
  toneHz: number | null;
  /** True while the voice is talking, so the bed can duck under it. */
  speaking: boolean;
  enabled?: boolean;
}): SessionBed {
  const [elapsedSeconds, setElapsed] = useState(0);
  const [isRunning, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  const beginBed = useCallback(() => {
    // Synchronous, and before anything is awaited. Creating an AudioContext
    // off the gesture tick is the classic way to get silence on iOS.
    unlockAudioSession();
    if (toneHz) toneGenerator().start(toneHz, 0.12);
    else ambientPad().start(BED_UNDER_SPEECH);
  }, [toneHz]);

  const endBed = useCallback(() => {
    if (toneHz) toneGenerator().stop();
    else ambientPad().stop();
  }, [toneHz]);

  const start = useCallback(() => {
    if (!enabled) return;
    beginBed();
    startedAtRef.current = Date.now();
    setRunning(true);
    setFinished(false);
  }, [beginBed, enabled]);

  const pause = useCallback(() => {
    if (startedAtRef.current !== null) {
      baseRef.current += (Date.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    endBed();
    setRunning(false);
  }, [endBed]);

  const stop = useCallback(() => {
    startedAtRef.current = null;
    baseRef.current = 0;
    endBed();
    setRunning(false);
    setElapsed(0);
    setFinished(false);
  }, [endBed]);

  const seekToRatio = useCallback(
    (ratio: number) => {
      const target = Math.max(0, Math.min(1, ratio)) * totalSeconds;
      baseRef.current = target;
      if (startedAtRef.current !== null) startedAtRef.current = Date.now();
      setElapsed(target);
    },
    [totalSeconds],
  );

  // The clock.
  useEffect(() => {
    if (!isRunning) return;

    const id = window.setInterval(() => {
      const live = startedAtRef.current === null ? 0 : (Date.now() - startedAtRef.current) / 1000;
      const next = baseRef.current + live;

      if (next >= totalSeconds) {
        setElapsed(totalSeconds);
        setFinished(true);
        setRunning(false);
        startedAtRef.current = null;
        endBed();
        return;
      }

      setElapsed(next);

      // Ease the bed down over the last stretch, so a sleep track doesn't end
      // by snapping to silence and waking the person it just settled.
      const remaining = totalSeconds - next;
      if (!toneHz && remaining < FADE_OUT_SECONDS) {
        ambientPad().setVolume((remaining / FADE_OUT_SECONDS) * BED_ALONE);
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [isRunning, totalSeconds, endBed, toneHz]);

  // Duck under the voice, lift when it stops.
  useEffect(() => {
    if (!isRunning || toneHz) return;
    const remaining = totalSeconds - elapsedSeconds;
    if (remaining < FADE_OUT_SECONDS) return;
    ambientPad().setVolume(speaking ? BED_UNDER_SPEECH : BED_ALONE);
  }, [speaking, isRunning, toneHz, totalSeconds, elapsedSeconds]);

  // Never leave sound running behind us.
  useEffect(() => endBed, [endBed]);

  return {
    elapsedSeconds,
    totalSeconds,
    isRunning,
    finished,
    start,
    pause,
    stop,
    seekToRatio,
  };
}
