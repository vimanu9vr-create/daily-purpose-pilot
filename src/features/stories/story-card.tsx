import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Heart, Play } from "lucide-react";

import { DreamCover } from "./dream-cover";

import { useCenterFocus } from "@/hooks/use-center-focus";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { cn } from "@/lib/utils";

export type StoryCardData = {
  id: string;
  hook: string;
  imageUrl: string;
  durationSeconds: number;
  isFavorite?: boolean;
  /** Which dream this belongs to, so it can show that dream's own artwork. */
  desireId?: string | null;
  /** Which of the dream's images to use — the story's variant. */
  coverIndex?: number;
};

export function minutesLabel(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} MIN`;
}

/**
 * The photo card that carries the whole feed: cover image, dark scrim,
 * serif hook line, duration badge and a play affordance.
 */
export function StoryCard({
  story,
  size = "lg",
  onToggleFavorite,
}: {
  story: StoryCardData;
  size?: "lg" | "sm";
  onToggleFavorite?: (id: string, next: boolean) => void;
}) {
  const dimensions =
    size === "lg" ? "w-[248px] h-[330px] md:w-[268px] md:h-[356px]" : "w-[168px] h-[224px]";

  return (
    <div
      data-focus-item
      className={cn("carousel-item relative", dimensions)}
      style={{
        transform: "scale(var(--focus-scale, 1))",
        opacity: "var(--focus-opacity, 1)",
        willChange: "transform",
      }}
    >
      <Link
        to="/app/story/$storyId"
        params={{ storyId: story.id }}
        // `relative` is load-bearing. The image and scrim inside are absolutely
        // positioned; without a positioned ancestor here their containing block
        // was the outer div, which put them *outside* this element's overflow
        // clip. The rounded corners were being drawn and then covered by a
        // square photo — which is why the cards looked like boxes.
        className="group relative block h-full w-full overflow-hidden rounded-[32px] shadow-card transition-transform duration-300 hover:-translate-y-1"
      >
        <DreamCover
          fallbackSrc={story.imageUrl}
          desireId={story.desireId}
          index={story.coverIndex ?? 0}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="photo-scrim absolute inset-0" />

        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <p
            className={cn(
              "font-display italic leading-snug text-white drop-shadow-sm",
              size === "lg" ? "text-[17px]" : "text-[14px]",
            )}
          >
            {story.hook}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-white/90 backdrop-blur-sm">
              {minutesLabel(story.durationSeconds)}
            </span>
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-white text-primary shadow-lg transition-transform duration-300 group-hover:scale-110",
                size === "lg" ? "h-11 w-11" : "h-9 w-9",
              )}
            >
              <Play className={cn("fill-current", size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} />
            </span>
          </div>
        </div>
      </Link>

      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(story.id, !story.isFavorite)}
          aria-label={story.isFavorite ? "Remove from saved" : "Save this story"}
          aria-pressed={story.isFavorite}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55"
        >
          <Heart className={cn("h-4 w-4", story.isFavorite && "fill-current text-ember")} />
        </button>
      )}
    </div>
  );
}

/** A titled horizontal row, matching the Trending / Affirmations / Sleep sections. */
export function CarouselSection({
  label,
  onSeeAll,
  children,
}: {
  label: string;
  onSeeAll?: (() => void) | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="eyebrow">{label}</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            See all
          </button>
        )}
      </div>
      <DraggableRow focusCenter>{children}</DraggableRow>
    </section>
  );
}

/**
 * Horizontal row that actually scrolls with a mouse. Without this, desktop
 * users see a row that appears frozen because plain overflow-x needs
 * shift+wheel.
 */
export function DraggableRow({
  children,
  className,
  focusCenter = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Scale the card nearest the middle up and its neighbours back. */
  focusCenter?: boolean;
}) {
  const { ref, canScrollLeft, canScrollRight, scrollBy, handlers } =
    useDragScroll<HTMLDivElement>();

  useCenterFocus(ref, focusCenter);

  return (
    <div className="group/row relative">
      <div
        ref={ref}
        {...handlers}
        className={cn("carousel -mx-5 cursor-grab px-5 pb-2 active:cursor-grabbing", className)}
      >
        {children}
      </div>

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-280)}
          aria-label="Scroll left"
          className="absolute -left-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md backdrop-blur transition hover:bg-white md:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(280)}
          aria-label="Scroll right"
          className="absolute -right-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-primary shadow-md backdrop-blur transition hover:bg-white md:flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
