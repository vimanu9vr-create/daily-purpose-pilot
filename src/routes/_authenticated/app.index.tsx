import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Loader2, Pencil, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DesireSheet } from "@/features/stories/desire-sheet";
import { useDesirePlaceholder } from "@/features/stories/desire-placeholder";
import { coverImage, themeFor } from "@/features/stories/imagery";
import { CarouselSection, DraggableRow, StoryCard } from "@/features/stories/story-card";
import { TrendingMarquee } from "@/features/stories/trending-marquee";
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
import { ActionEmptyState, TodaysAction } from "@/features/actions/todays-action";
import { useEnsureTodaysActions, useTodaysActions } from "@/features/actions/use-actions";
import { PracticeCard } from "@/features/practice/practice-card";
import { DesireProgress } from "@/features/milestones/desire-progress";
import { WeekCard } from "@/features/insights/week-card";

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
  const [selectedDesireId, setSelectedDesireId] = useState<string | null>(null);

  // Stops typing itself once the user starts typing — two cursors racing in
  // one box is horrible.
  const placeholder = useDesirePlaceholder(input.length === 0);
  const firstName = profile?.display_name?.trim().split(" ")[0];

  const hasDesires = (desires?.length ?? 0) > 0;
  const storyList = stories ?? [];

  // First run: as soon as there's a desire and no stories, fill the feed.
  useEffect(() => {
    if (hasDesires && !isPending && storyList.length === 0 && !generate.isPending) {
      generate.mutate({ perDesire: 3 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDesires, isPending, storyList.length]);

  // Today's actions. Generated once a day per desire, on first open.
  const { data: actions } = useTodaysActions();
  const ensureActions = useEnsureTodaysActions();
  useEffect(() => {
    if (!desires || desires.length === 0 || ensureActions.isPending) return;
    ensureActions.mutate(
      desires.map((desire) => ({
        id: desire.id,
        title: desire.title,
        category: desire.category,
        description: desire.description,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desires?.length]);

  // Only personalised stories belong on Home; the catalogue lives in Library.
  const storiesOnly = storyList.filter((s) => s.kind === "story");
  const selectedDesire = desires?.find((d) => d.id === selectedDesireId) ?? null;
  const filteredStories = selectedDesireId
    ? storiesOnly.filter((s) => s.desire_id === selectedDesireId)
    : storiesOnly;
  const forYou = filteredStories.slice(0, 8);
  const trending = filteredStories.slice(8, 16);

  // Suggestions the user hasn't already added.
  const trendingItems = TRENDING_DESIRES.filter(
    (title) => !desires?.some((d) => d.title === title),
  );

  function submitDesire(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setInput("");
    createDesire.mutate({ title: trimmed }, { onSuccess: () => generate.mutate({ perDesire: 3 }) });
  }

  return (
    <PageTransition>
      {/* The question, by name. This is the line that makes the app feel like
          it's addressing you rather than presenting a form. */}
      <h1 className="mb-5 text-center font-display text-[26px] font-medium leading-[1.25]">
        {firstName ? `${firstName}, what do you` : "What do you"}
        <br />
        want to <em className="italic">manifest?</em>
      </h1>

      {/* Desire input — the way you tell the app what you want */}
      <div className="glass-panel flex items-center gap-2 rounded-full py-1.5 pl-5 pr-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitDesire(input)}
          placeholder={placeholder}
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

      {/* Trending strip — drifts on its own so it reads as tappable */}
      <p className="eyebrow mt-6 text-center">🔥 Trending manifestations</p>
      <TrendingMarquee
        className="mt-3"
        items={trendingItems}
        onSelect={(title) => submitDesire(title)}
      />

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

      {hasDesires && (
        <DraggableRow className="mt-3 pb-1">
          {desires!.map((desire) => {
            const selected = selectedDesireId === desire.id;
            return (
              <button
                key={desire.id}
                type="button"
                // These were <span> elements — inert. Tapping your own desire
                // did nothing at all, which is what "euro summer vacation, a
                // calmer mind, more money is not working" was: five chips that
                // looked like buttons and weren't wired to anything.
                onClick={() => setSelectedDesireId(selected ? null : desire.id)}
                aria-pressed={selected}
                className={cn(
                  "carousel-item whitespace-nowrap rounded-full px-5 py-2.5 text-[13px] font-medium transition active:scale-95",
                  selected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-primary/10 text-primary",
                )}
              >
                {desire.title}
              </button>
            );
          })}
        </DraggableRow>
      )}

      {/* The practice, which is the daily loop. Above the actions because it
          ends by offering them, so doing it first is the shorter path. */}
      <PracticeCard />

      {/* Today's action sits above the stories on purpose. Listening is the
          easy half; this is the half that changes anything. */}
      {hasDesires && (
        <section className="mt-6 space-y-3">
          {(actions ?? [])
            .filter((action) => !selectedDesireId || action.desire_id === selectedDesireId)
            .map((action) => {
              const desire = desires!.find((d) => d.id === action.desire_id);
              if (!desire) return null;
              return (
                <TodaysAction
                  key={action.id}
                  action={action}
                  desireTitle={desire.title}
                  category={desire.category}
                />
              );
            })}
        </section>
      )}

      {!hasDesires && (
        <section className="mt-6">
          <ActionEmptyState />
        </section>
      )}

      {/* Progress, derived from milestones ticked and actions done — never a
          number anybody typed. */}
      {hasDesires && <DesireProgress desires={desires!} />}

      {/* Hidden until there's something to report — a week of zeroes is an
          accusation, not information. */}
      <WeekCard />

      {selectedDesire && filteredStories.length === 0 && !generate.isPending && (
        <section className="mt-8 rounded-3xl glass-panel px-7 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing written for “{selectedDesire.title}” yet.
          </p>
          <Button
            variant="glass"
            size="sm"
            className="mt-4 rounded-full"
            onClick={() => generate.mutate({ perDesire: 3 })}
            disabled={generate.isPending}
          >
            <Sparkles className="h-3.5 w-3.5" /> Write some now
          </Button>
        </section>
      )}

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
