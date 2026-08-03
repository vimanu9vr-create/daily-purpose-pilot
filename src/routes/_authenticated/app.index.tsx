import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Loader2, Pencil, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { DesireSheet } from "@/features/stories/desire-sheet";
import { coverImage, themeFor } from "@/features/stories/imagery";
import { CarouselSection, DraggableRow, StoryCard } from "@/features/stories/story-card";
import {
  TRENDING_DESIRES,
  nextRefreshAt,
  useCreateDesire,
  useDesires,
  useGenerateStories,
  useStories,
  useToggleStoryFavorite,
} from "@/features/stories/use-stories";
import { useProfile } from "@/features/onboarding/use-profile";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "ManifestAI" }] }),
  component: HomeFeed,
});

function HomeFeed() {
  const { data: profile } = useProfile();
  const { data: desires } = useDesires();
  const { data: stories, isPending } = useStories();
  const createDesire = useCreateDesire();
  const generate = useGenerateStories();
  const toggleFavorite = useToggleStoryFavorite();

  const [input, setInput] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const hasDesires = (desires?.length ?? 0) > 0;
  const storyList = stories ?? [];

  // First run: as soon as there's a desire and no stories, fill the feed.
  useEffect(() => {
    if (hasDesires && !isPending && storyList.length === 0 && !generate.isPending) {
      generate.mutate({ perDesire: 3 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDesires, isPending, storyList.length]);

  const forYou = storyList.slice(0, 8);
  const trending = storyList.slice(8, 16);

  function submitDesire(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setInput("");
    createDesire.mutate({ title: trimmed }, { onSuccess: () => generate.mutate({ perDesire: 3 }) });
  }

  return (
    <PageTransition>
      {/* Desire input — the way you tell the app what you want */}
      <div className="glass-panel flex items-center gap-2 rounded-full py-1.5 pl-5 pr-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitDesire(input)}
          placeholder="him obsessed with me."
          aria-label="What do you want?"
          className="min-w-0 flex-1 bg-transparent py-2 font-display text-[15px] italic text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => submitDesire(input)}
          disabled={!input.trim() || createDesire.isPending}
          aria-label="Add this desire"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
        >
          {createDesire.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-medium leading-none">
          {profile?.display_name ? `For ${profile.display_name.split(" ")[0]}` : "For you"}
        </h1>
        <Button
          variant="glass"
          size="sm"
          className="rounded-full"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-3.5 w-3.5" /> Edit desires
        </Button>
      </div>

      {/* Desire chips */}
      <DraggableRow className="mt-4 pb-1">
        {(hasDesires ? desires! : []).map((desire) => (
          <span
            key={desire.id}
            className="carousel-item rounded-full bg-white/70 px-4 py-2 text-xs font-medium text-secondary-foreground shadow-sm"
          >
            {desire.title}
          </span>
        ))}
        {TRENDING_DESIRES.filter((t) => !desires?.some((d) => d.title === t)).map((title) => (
          <button
            key={title}
            type="button"
            onClick={() => submitDesire(title)}
            className="carousel-item rounded-full border border-border/70 px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-white/60"
          >
            {title}
          </button>
        ))}
      </DraggableRow>

      {!hasDesires && (
        <section className="mt-10 rounded-3xl glass-panel px-7 py-12 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-4 font-display text-2xl">What do you want?</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Write it above, or tap one of the suggestions. Your stories are written from your own
            words and refresh through the day.
          </p>
        </section>
      )}

      {hasDesires && (isPending || generate.isPending) && storyList.length === 0 && (
        <div className="mt-10 flex flex-col items-center py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Writing your stories…</p>
        </div>
      )}

      {forYou.length > 0 && (
        <CarouselSection label="Trending for you">
          {forYou.map((story) => (
            <StoryCard
              key={story.id}
              story={{
                id: story.id,
                hook: story.hook ?? story.title,
                imageUrl: story.image_url ?? coverImage(story.id, themeFor(story.category)),
                durationSeconds: story.duration_seconds,
                isFavorite: story.is_favorite,
              }}
              onToggleFavorite={(id, next) => toggleFavorite.mutate({ id, isFavorite: next })}
            />
          ))}
        </CarouselSection>
      )}

      {trending.length > 0 && (
        <CarouselSection label="More for you">
          {trending.map((story) => (
            <StoryCard
              key={story.id}
              size="sm"
              story={{
                id: story.id,
                hook: story.hook ?? story.title,
                imageUrl: story.image_url ?? coverImage(story.id, themeFor(story.category)),
                durationSeconds: story.duration_seconds,
                isFavorite: story.is_favorite,
              }}
            />
          ))}
        </CarouselSection>
      )}

      {storyList.length > 0 && (
        <RefreshCountdown
          onRefresh={() => generate.mutate({ perDesire: 3 })}
          busy={generate.isPending}
        />
      )}

      <DesireSheet open={editOpen} onOpenChange={setEditOpen} />
    </PageTransition>
  );
}

function RefreshCountdown({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { label, progress, due } = useMemo(() => {
    const target = nextRefreshAt(now);
    const remaining = Math.max(0, target.getTime() - now.getTime());
    const h = Math.floor(remaining / 3_600_000);
    const m = Math.floor((remaining % 3_600_000) / 60_000);
    const s = Math.floor((remaining % 60_000) / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      label: `${pad(h)}:${pad(m)}:${pad(s)}`,
      progress: 1 - remaining / (4 * 3_600_000),
      due: remaining <= 0,
    };
  }, [now]);

  return (
    <section className="mt-12 text-center">
      <p className="eyebrow text-muted-foreground">All stories refresh in</p>
      <p className="mt-2 font-display text-[34px] tabular-nums tracking-[0.08em]">{label}</p>
      <div className="mx-auto mt-4 h-[3px] w-56 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
      {due && (
        <Button
          variant="glass"
          size="sm"
          className="mt-5 rounded-full"
          onClick={onRefresh}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Refresh now
        </Button>
      )}
    </section>
  );
}
