import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { DraggableRow } from "@/features/stories/story-card";
import { coverImage, themeFor } from "@/features/stories/imagery";

import { useAnchorAffirmation, useSavedAffirmations } from "./use-affirmations";

/**
 * The user's own affirmations, on Home.
 *
 * They were being written correctly and put nowhere anyone would look — the
 * AI generated six from a typed desire, saved them, and Home carried on
 * showing only stories. Someone types what they want, sees "42 stories
 * created", and reasonably concludes the affirmations don't work. They did;
 * they were two taps away on another tab.
 *
 * A single swipeable row rather than a list, because Home has already been too
 * long once and this is meant to be a glance, not a reading session.
 */
export function AffirmationRow({
  isGenerating = false,
  desireId,
}: {
  isGenerating?: boolean;
  /** The dream in focus, if one is selected. Its anchor is shown above the row. */
  desireId?: string | null;
}) {
  const { data: affirmations, isPending } = useSavedAffirmations();
  const { data: anchor } = useAnchorAffirmation(desireId);

  const mine = (affirmations ?? []).filter((row) => row.source === "ai").slice(0, 10);

  if (isPending) return null;

  // Only speak up while something is genuinely being written. An empty row
  // with a spinner on a normal morning is noise.
  if (mine.length === 0) {
    if (!isGenerating) return null;
    return (
      <section className="mt-8">
        <p className="eyebrow">Your affirmations</p>
        <div className="mt-3 flex items-center gap-3 rounded-[24px] border border-glass-border bg-card/40 px-5 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Writing these from your own words…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      {/*
        The anchor, when a dream is in focus.

        Six affirmations in a swipeable row is a list, and a list is something
        you scroll past. This is the one line written to be repeated — shortest
        of the set, most concrete, no hedging — given the room to be read
        rather than skimmed. The other six stay underneath as variation.
      */}
      {anchor && (
        <div className="mb-5 rounded-[28px] surface-gradient p-[1px]">
          <div className="rounded-[27px] bg-card/85 px-6 py-7 text-center">
            <p className="eyebrow text-muted-foreground">Say this one</p>
            <p className="mt-3 font-display text-[21px] italic leading-snug">{anchor.text}</p>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="eyebrow">Your affirmations</h2>
        <Link
          to="/app/affirmations"
          className="text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          See all
        </Link>
      </div>

      <DraggableRow className="pb-1">
        {mine.map((affirmation) => (
          <Link
            key={affirmation.id}
            to="/app/affirmations"
            className="carousel-item relative block h-[190px] w-[150px] shrink-0 overflow-hidden rounded-[26px] shadow-card"
          >
            <img
              src={coverImage(affirmation.id, themeFor(affirmation.category))}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <span className="absolute inset-x-3 bottom-3 font-display text-[13px] italic leading-snug text-white">
              {affirmation.text}
            </span>
          </Link>
        ))}
      </DraggableRow>
    </section>
  );
}
