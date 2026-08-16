import { useEffect, useState } from "react";

/**
 * Images made for one person's dream, with the stock photo underneath.
 *
 * The problem: there are thirty-two stock photographs in the app, four per
 * theme, and `themeFor()` funnels most free text into one theme — so a feed of
 * forty cards was drawing from a pool of four. They're also the same four for
 * every user of the app, which is a strange thing for a manifestation app to
 * be true of.
 *
 * So each dream gets six images generated from the words the person wrote, and
 * a story shows the one matching the scene it's set in. Six rather than one,
 * because a single image repeated across a dream's stories is still
 * repetition — just aimed better.
 *
 * ## Why the URL is computed rather than stored
 *
 * The path is derived from the dream's id, so the client can name the file
 * without asking the database where it is. That avoids a column, a migration
 * and a join, and it means a cover that finishes generating five minutes from
 * now appears on the next render with nothing needing to be told about it.
 *
 * The cost is that the URL is a guess until the image exists — so every use
 * goes through a component that falls back on error. That fallback isn't a
 * nicety: for the first minute of a new dream, none of these files are there.
 */

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;

/** How many are generated per dream. Must match the edge function. */
export const DREAM_COVER_COUNT = 6;

export function dreamCoverUrl(desireId: string, index: number): string | null {
  if (!SUPABASE_URL) return null;
  const safe = Math.abs(index) % DREAM_COVER_COUNT;
  return `${SUPABASE_URL}/storage/v1/object/public/vision/covers/desire/${desireId}/${safe}.png`;
}

/**
 * Which of the dream's images a story gets. Stable, so a card doesn't change
 * picture between renders or between devices.
 */
export function coverIndexFor(storyId: string): number {
  let hash = 0;
  for (let i = 0; i < storyId.length; i += 1) {
    hash = (hash << 5) - hash + storyId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % DREAM_COVER_COUNT;
}

type CoverProps = {
  /** The stock photograph. Always shown until something better loads. */
  fallbackSrc: string;
  /** The dream this belongs to, if any. */
  desireId?: string | null | undefined;
  /** Which of the dream's images — usually the story's variant. */
  index?: number | undefined;
  /** An image already generated for this exact story, which wins outright. */
  exactSrc?: string | null | undefined;
  className?: string | undefined;
  alt?: string | undefined;
};

/**
 * Picks the most specific image available, and degrades quietly.
 *
 * Order: an image made for this story, then one made for its dream, then the
 * stock photo. Each step down happens on a load error, so a missing file costs
 * a request and nothing else — no spinner, no gap, no broken-image icon.
 */
export function DreamCover({
  fallbackSrc,
  desireId,
  index = 0,
  exactSrc,
  className,
  alt = "",
}: CoverProps) {
  const candidates = [
    exactSrc,
    desireId ? dreamCoverUrl(desireId, index) : null,
    fallbackSrc,
  ].filter((src): src is string => Boolean(src));

  const [attempt, setAttempt] = useState(0);

  // A new story in the same card slot has to start from its own best option
  // rather than inheriting the previous one's failures.
  useEffect(() => setAttempt(0), [exactSrc, desireId, index, fallbackSrc]);

  const src = candidates[Math.min(attempt, candidates.length - 1)]!;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setAttempt((current) => Math.min(current + 1, candidates.length - 1))}
    />
  );
}
