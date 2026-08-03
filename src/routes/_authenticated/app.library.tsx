import { createFileRoute } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { coverImage, themeFor } from "@/features/stories/imagery";
import { CarouselSection, StoryCard } from "@/features/stories/story-card";
import { FREQUENCY_DISCLAIMER, KIND_LABELS, KIND_ORDER } from "@/features/stories/track-catalogue";
import { useStories, useToggleStoryFavorite, type Story } from "@/features/stories/use-stories";
import { useHasTracks, useSeedTracks } from "@/features/stories/use-tracks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/library")({
  head: () => ({ meta: [{ title: "Library — ManifestAI" }] }),
  component: Library,
});

const FILTERS = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "unplayed", label: "Not played" },
] as const;

function toCard(story: Story) {
  return {
    id: story.id,
    hook: story.hook ?? story.title,
    imageUrl: story.image_url ?? coverImage(story.id, themeFor(story.category)),
    durationSeconds: story.duration_seconds,
    isFavorite: story.is_favorite,
  };
}

function Library() {
  const { data: stories, isPending } = useStories();
  const { data: hasTracks } = useHasTracks();
  const seedTracks = useSeedTracks();
  const toggleFavorite = useToggleStoryFavorite();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [seeAll, setSeeAll] = useState<string | null>(null);

  // Sleep, meditation and frequency tracks are the same for everyone, so they
  // get seeded once rather than generated.
  useEffect(() => {
    if (hasTracks === false && !seedTracks.isPending) {
      seedTracks.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTracks]);

  const all = useMemo(() => stories ?? [], [stories]);

  const visible = useMemo(() => {
    if (filter === "saved") return all.filter((s) => s.is_favorite);
    if (filter === "unplayed") return all.filter((s) => !s.listened_at);
    return all;
  }, [all, filter]);

  const byKind = useMemo(() => {
    const map = new Map<string, Story[]>();
    for (const story of visible) {
      const kind = story.kind || "story";
      map.set(kind, [...(map.get(kind) ?? []), story]);
    }
    return KIND_ORDER.map((kind) => [kind, map.get(kind) ?? []] as const).filter(
      ([, items]) => items.length > 0,
    );
  }, [visible]);

  const expanded = seeAll ? (byKind.find(([kind]) => kind === seeAll)?.[1] ?? []) : null;

  return (
    <PageTransition>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-[32px] font-medium leading-none">
            {seeAll ? KIND_LABELS[seeAll] : "Library"}
          </h1>
          <p className="eyebrow mt-2 text-muted-foreground">
            {seeAll ? `${expanded?.length ?? 0} sessions` : "Everything to listen to"}
          </p>
        </div>
        {seeAll && (
          <button
            type="button"
            onClick={() => setSeeAll(null)}
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            Back
          </button>
        )}
      </header>

      {!seeAll && (
        <div className="mt-5 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-medium transition",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/60 text-muted-foreground hover:bg-white/80",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isPending && (
        <div className="mt-16 flex justify-center">
          <Headphones className="h-6 w-6 animate-pulse text-primary/50" />
        </div>
      )}

      {!isPending && visible.length === 0 && (
        <section className="mt-12 rounded-3xl glass-panel px-8 py-14 text-center">
          <Headphones className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-4 font-display text-2xl">
            {filter === "saved" ? "Nothing saved yet" : "Nothing here yet"}
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {filter === "saved"
              ? "Tap the heart on anything and it'll be kept here."
              : "Add something you want on the home tab and your sessions appear here."}
          </p>
        </section>
      )}

      {/* Expanded single section */}
      {expanded && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {expanded.map((story) => (
            <div key={story.id} className="[&>div]:!w-full">
              <StoryCard
                story={toCard(story)}
                size="sm"
                onToggleFavorite={(id, next) => toggleFavorite.mutate({ id, isFavorite: next })}
              />
            </div>
          ))}
        </div>
      )}

      {/* Section rows */}
      {!seeAll &&
        byKind.map(([kind, items]) => (
          <div key={kind}>
            <CarouselSection
              label={KIND_LABELS[kind] ?? kind}
              onSeeAll={items.length > 2 ? () => setSeeAll(kind) : undefined}
            >
              {items.map((story) => (
                <StoryCard
                  key={story.id}
                  story={toCard(story)}
                  onToggleFavorite={(id, next) => toggleFavorite.mutate({ id, isFavorite: next })}
                />
              ))}
            </CarouselSection>
            {kind === "frequency" && (
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
                {FREQUENCY_DISCLAIMER}
              </p>
            )}
          </div>
        ))}
    </PageTransition>
  );
}
