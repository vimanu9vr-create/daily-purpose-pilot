import { useMemo } from "react";

/**
 * Splitting narration into sentences, and formatting a clock.
 *
 * This file used to contain a full speech-synthesis narrator. It's gone, along
 * with the device voice it drove — see `useSentences` below for why.
 */

export function splitSentences(body: string): string[] {
  return body
    .split(/\n\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Which sentence indices open a new paragraph — those get a longer pause. */
function paragraphStartIndices(body: string): Set<number> {
  const starts = new Set<number>();
  let index = 0;
  for (const paragraph of body.split(/\n\n+/)) {
    const count = paragraph.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length;
    if (count === 0) continue;
    starts.add(index);
    index += count;
  }
  return starts;
}

/**
 * The sentences a piece of narration is made of.
 *
 * All that survives of the old speech-synthesis hook. The browser voice it
 * used to drive has been removed: it was only ever reachable when Sarah was
 * still generating, which meant it appeared exactly when someone was paying
 * closest attention, and made the app sound like a satnav reading a
 * meditation. Waiting in silence is the honest version.
 *
 * The sentence list is still needed — for the transcript, and for the
 * highlighting that follows the real audio.
 */
export function useSentences(body: string): string[] {
  return useMemo(() => splitSentences(body), [body]);
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
