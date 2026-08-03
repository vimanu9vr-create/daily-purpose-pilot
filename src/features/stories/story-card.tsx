import { Link } from "@tanstack/react-router";
import { Heart, Play } from "lucide-react";

import { cn } from "@/lib/utils";

export type StoryCardData = {
  id: string;
  hook: string;
  imageUrl: string;
  durationSeconds: number;
  isFavorite?: boolean;
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
    <div className={cn("carousel-item relative", dimensions)}>
      <Link
        to="/app/story/$storyId"
        params={{ storyId: story.id }}
        className="group block h-full w-full overflow-hidden rounded-3xl shadow-card transition-transform duration-300 hover:-translate-y-1"
      >
        <img
          src={story.imageUrl}
          alt=""
          loading="lazy"
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
            <span className="rounded-lg bg-black/45 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-white/90 backdrop-blur-sm">
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
  onSeeAll?: () => void;
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
      <div className="carousel -mx-5 px-5 pb-2">{children}</div>
    </section>
  );
}
