import { createFileRoute } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { useMemo, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { coverImage, themeFor } from "@/features/stories/imagery";
import { CarouselSection, StoryCard } from "@/features/stories/story-card";
import { useStories, useToggleStoryFavorite, type Story } from "@/features/stories/use-stories";
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
  const toggleFavorite = useToggleStoryFavorite();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const all = useMemo(() => stories ?? [], [stories]);

  const visible = useMemo(() => {
    if (filter === "saved") return all.filter((s) => s.is_favorite);
    if (filter === "unplayed") return all.filter((s) => !s.listened_at);
    return all;
  }, [all, filter]);

  // Group by the theme the cover art uses, so rows read like Stella's sections.
  const grouped = useMemo(() => {
    const map = new Map<string, Story[]>();
    for (const story of visible) {
      const key = themeFor(story.category ?? story.title);
      map.set(key, [...(map.get(key) ?? []), story]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

  const THEME_LABELS: Record<string, string> = {
    wealth: "Wealth & abundance",
    love: "Love & relationships",
    career: "Career & ambition",
    calm: "Calm & sleep",
    health: "Health & body",
    confidence: "Confidence",
    travel: "Travel & freedom",
    home: "Home & space",
  };

  return (
    <PageTransition>
      <header>
        <h1 className="font-display text-[32px] font-medium leading-none">Library</h1>
        <p className="eyebrow mt-2 text-muted-foreground">Everything written for you</p>
      </header>

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
              ? "Tap the heart on any story and it'll be kept here."
              : "Add something you want on the home tab and your stories appear here."}
          </p>
        </section>
      )}

      {grouped.map(([theme, items]) => (
        <CarouselSection key={theme} label={THEME_LABELS[theme] ?? theme}>
          {items.map((story) => (
            <StoryCard
              key={story.id}
              story={toCard(story)}
              onToggleFavorite={(id, next) => toggleFavorite.mutate({ id, isFavorite: next })}
            />
          ))}
        </CarouselSection>
      ))}
    </PageTransition>
  );
}
