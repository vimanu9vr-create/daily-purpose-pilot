import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Loader2, Pencil, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DesireSheet } from "@/features/stories/desire-sheet";
import { useDesirePlaceholder } from "@/features/stories/desire-placeholder";
import { coverIndexFor } from "@/features/stories/dream-cover";
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
import { AffirmationRow } from "@/features/affirmations/affirmation-row";

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

  /**
   * Refill the feed when there are no stories in it.
   *
   * Counts `storiesOnly`, not everything fetched. The query returns the
   * library tracks as well now, and those never expire — so a check against
   * the whole list would see thirty-five rows, conclude the feed was fine, and
   * leave Home showing nothing but sleep tracks forever once the day's stories
   * aged out. The refill has to ask about the thing it refills.
   */
  const storiesOnly = storyList.filter((s) => s.kind === "story");

  useEffect(() => {
    if (hasDesires && !isPending && storiesOnly.length === 0 && !generate.isPending) {
      generate.mutate({ perDesire: 6 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDesires, isPending, storiesOnly.length]);

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

  /**
   * The one action to show. The selected desire's if a chip is active, the
   * oldest incomplete one otherwise — oldest because the thing you've been
   * avoiding longest is the thing worth surfacing.
   */
  const todaysAction = useMemo(() => {
    const rows = actions ?? [];
    if (rows.length === 0 || !desires) return null;

    const pick =
      (selectedDesireId && rows.find((a) => a.desire_id === selectedDesireId)) ??
      rows.find((a) => !a.completed_at) ??
      rows[0];
    if (!pick) return null;

    const desire = desires.find((d) => d.id === pick.desire_id);
    return desire ? { action: pick, desire } : null;
  }, [actions, desires, selectedDesireId]);

  // Only personalised stories belong on Home; the catalogue lives in Library.
  const selectedDesire = desires?.find((d) => d.id === selectedDesireId) ?? null;
  const filteredStories = selectedDesireId
    ? storiesOnly.filter((s) => s.desire_id === selectedDesireId)
    : storiesOnly;
  // The two rows must never show the same story. Before, "trending" started
  // at index 8 whether or not eight existed — with three stories the slice was
  // empty, and with more it silently repeated the top of the list as the feed
  // reordered. Splitting the same array in half can't overlap.
  const half = Math.ceil(filteredStories.length / 2);
  const forYou = filteredStories.slice(0, Math.min(half, 8));
  const trending = filteredStories.slice(Math.min(half, 8), 16);

  // Suggestions the user hasn't already added.
  const trendingItems = TRENDING_DESIRES.filter(
    (title) => !desires?.some((d) => d.title === title),
  );

  function submitDesire(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setInput("");
    createDesire.mutate({ title: trimmed }, { onSuccess: () => generate.mutate({ perDesire: 6 }) });
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

      {/* One action, not one per desire.
          
          This screen showed a card for every desire, so three desires meant
          three things being asked of you before you had read anything. Being
          handed a to-do list on opening an app about calm is the wrong feeling,
          and three asks get ignored where one gets done. The rest are on the
          goal itself. */}
      {hasDesires && todaysAction && (
        <section className="mt-6">
          <TodaysAction
            action={todaysAction.action}
            desireTitle={todaysAction.desire.title}
            category={todaysAction.desire.category}
          />
        </section>
      )}

      {!hasDesires && (
        <section className="mt-6">
          <ActionEmptyState />
        </section>
      )}

      {/* Always render something when a desire is selected but has nothing
          under it. This block used to be hidden while generation was running,
          and the loading spinner below only appeared when the *whole* feed was
          empty — so selecting a desire with no stories, while other desires
          had some, rendered literally nothing. That was the blank screen. */}
      {/* The affirmations written from what you typed. These existed but lived
          only on another tab, so typing a desire looked like it produced
          stories and nothing else. */}
      {hasDesires && <AffirmationRow isGenerating={createDesire.isPending} />}

      {selectedDesire && filteredStories.length === 0 && (
        <section className="mt-8 rounded-3xl glass-panel px-7 py-10 text-center">
          {generate.isPending ? (
            <>
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Writing stories for “{selectedDesire.title}”…
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Nothing written for “{selectedDesire.title}” yet.
              </p>
              <Button
                variant="glass"
                size="sm"
                className="mt-4 rounded-full"
                onClick={() => generate.mutate({ perDesire: 6 })}
              >
                <Sparkles className="h-3.5 w-3.5" /> Write some now
              </Button>
            </>
          )}
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

      {hasDesires && (isPending || generate.isPending) && storiesOnly.length === 0 && (
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
                desireId: story.desire_id,
                coverIndex: coverIndexFor(story.id),
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
                desireId: story.desire_id,
                coverIndex: coverIndexFor(story.id),
                durationSeconds: story.duration_seconds,
                isFavorite: story.is_favorite,
              }}
            />
          ))}
        </CarouselSection>
      )}

      {storiesOnly.length > 0 && (
        <RefreshCountdown
          onRefresh={() => generate.mutate({ perDesire: 6 })}
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
