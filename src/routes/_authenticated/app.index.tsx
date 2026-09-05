import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Loader2, Pencil, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  REFRESH_HOURS,
  TRENDING_DESIRES,
  interleaveByDesire,
  displayHook,
  nextRefreshAt,
  useCreateDesire,
  useDesires,
  useGenerateStories,
  useStories,
  useToggleStoryFavorite,
} from "@/features/stories/use-stories";
import { useProfile } from "@/features/onboarding/use-profile";
import { PracticeCard } from "@/features/practice/practice-card";
import { AffirmationRow } from "@/features/affirmations/affirmation-row";
import { useMilestones, useSeedMilestones } from "@/features/milestones/use-milestones";
import {
  useAffirmationsByDesire,
  useGenerateAffirmations,
} from "@/features/affirmations/use-affirmations";
import { useEnsureTodaysActions, useTodaysActions } from "@/features/actions/use-actions";

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
   * Counts `storiesOnly`, not everything fetched. The query returns the
   * library tracks as well, and those never expire — so a check against the
   * whole list would see thirty-five rows and conclude the feed was fine.
   */
  const storiesOnly = storyList.filter((s) => s.kind === "story");

  /** When the newest story in the feed was written. 0 if there are none. */
  const newestStoryAt = useMemo(() => {
    let newest = 0;
    for (const story of storiesOnly) {
      const at = new Date(story.created_at).getTime();
      if (at > newest) newest = at;
    }
    return newest;
  }, [storiesOnly]);

  /**
   * Refill when the feed is EMPTY OR STALE — and the second half is the fix.
   *
   * This used to fire only on `length === 0`. That worked while stories
   * expired and were filtered out, because the feed genuinely emptied itself
   * once a day. Then I removed the expiry filter (to stop dreams with no
   * replacement going blank), and in doing so removed the only thing that ever
   * made this condition true.
   *
   * The result was an app that never wrote another story. Reported twice as
   * the writing still being the old writing — and both times I assumed the new
   * code hadn't shipped. It had. Home was simply showing the same twenty-two
   * stories forever, because nothing was left to trigger a refresh, while a
   * countdown on the same screen promised one every twenty-four hours.
   *
   * Asking how old the newest story is says what the countdown already says.
   */
  useEffect(() => {
    if (!hasDesires || isPending || generate.isPending) return;

    const ageHours = newestStoryAt === 0 ? Infinity : (Date.now() - newestStoryAt) / 3_600_000;
    if (ageHours < REFRESH_HOURS) return;

    generate.mutate({ perDesire: 6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDesires, isPending, storiesOnly.length, newestStoryAt]);

  /**
   * Today's Action is no longer on Home.
   *
   * Removed at Viggnesh's request after we established that every one of the
   * eleven actions on screen was a canned template rather than anything
   * written for him — and that this had been true all day, because the AI
   * upgrade only ever got one attempt and that attempt happened while the
   * provider was refusing every request.
   *
   * Deliberately removed from this screen only. The table, the edge function
   * and the actions inside each goal are untouched, and the daily practice
   * still offers them at the end. Deleting the feature outright would also
   * delete the only part of the app that asks for effort rather than
   * attention, which is a bigger decision than tidying up Home — and it is
   * easy to put back and hard to rebuild.
   */

  // Only personalised stories belong on Home; the catalogue lives in Library.
  const selectedDesire = desires?.find((d) => d.id === selectedDesireId) ?? null;
  const filteredStories = selectedDesireId
    ? storiesOnly.filter((s) => s.desire_id === selectedDesireId)
    : // Newest-first would show sixteen cards from whichever dream was written
      // for last. One from each, in turn, so every dream is on the screen.
      interleaveByDesire(storiesOnly);

  /**
   * THE FEED BELONGS TO ONE DREAM. Default it to the newest.
   *
   * Reported as: "I typed I am earning 10k week and it's showing something
   * related to defender car in More for you and Trending for you."
   *
   * Exactly right. Typing a dream selected it, so the feed was correct in that
   * moment — and on the next page load the selection reset to null, which fell
   * through to an interleave of EVERY dream. So the app answered "what do you
   * want to manifest?" with a shuffle of everything you had ever answered, and
   * a question that doesn't act on your answer isn't a question.
   *
   * I built that interleave to fix the opposite complaint — a dream that never
   * appeared at all — and overcorrected into a feed that belongs to nobody in
   * particular. The right shape is one dream at a time with the others one tap
   * away, which fixes both: nothing is hidden, and nothing is mixed.
   */
  useEffect(() => {
    if (selectedDesireId || !desires?.length) return;
    setSelectedDesireId(desires[0]!.id);
  }, [desires, selectedDesireId]);

  /**
   * Write affirmations for a dream that has none, the same way stories are.
   *
   * "I want to buy defender car" had seven stories, seven photographs and ZERO
   * affirmations, so selecting it showed an empty anchor where the one line to
   * carry around should be. Affirmations are only written at the moment a
   * dream is created, so any dream older than that feature has none and no
   * amount of using the app ever fixes it.
   *
   * Same shape as the story backfill above: the screen asks for what's missing
   * rather than waiting for somebody to find a button.
   */
  const affirmationsFor = useAffirmationsByDesire(selectedDesireId);
  const generateAffirmations = useGenerateAffirmations();
  useEffect(() => {
    if (!selectedDesireId || affirmationsFor.isPending || generateAffirmations.isPending) return;
    if ((affirmationsFor.data?.length ?? 0) > 0) return;
    generateAffirmations.mutate({ desireId: selectedDesireId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDesireId, affirmationsFor.isPending, affirmationsFor.data?.length]);

  /**
   * And its milestones. Same rule: selected, empty, so write them.
   *
   * These were seeded only by the progress panel on the Profile screen, so a
   * dream had steps if and only if you happened to visit Profile after adding
   * it. Not one of the three live dreams had a single milestone, and
   * `suggest-milestones` had not been called once in twenty-four hours.
   *
   * Everything a dream needs is now written from the screen where the dream
   * was typed, rather than from wherever somebody happens to navigate next.
   */
  const milestonesFor = useMilestones(selectedDesireId);
  const seedMilestones = useSeedMilestones();
  useEffect(() => {
    if (!selectedDesire || milestonesFor.isPending || seedMilestones.isPending) return;
    if ((milestonesFor.data?.length ?? 0) > 0) return;
    seedMilestones.mutate({
      desireId: selectedDesire.id,
      title: selectedDesire.title,
      category: selectedDesire.category,
      why: selectedDesire.description,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDesire?.id, milestonesFor.isPending, milestonesFor.data?.length]);

  /**
   * And today's action. Same rule again, and the one that was missing.
   *
   * `useEnsureTodaysActions` was written, tested, exported — and never called
   * from anywhere in the app. The edge function existed, the hook existed, the
   * card that renders an action existed. Nothing ever asked for one, so the
   * `actions` table stayed empty, Home never showed the card, and the practice
   * fell through to its hardcoded line every single day:
   *
   *     "Write down the very next physical step toward this. Not the plan —
   *      the step."
   *
   * Which is the app telling somebody to do the one job the app is for. The
   * step that closes the practice, the only thing in this product no competitor
   * attempts, has been a placeholder for its whole life because of a missing
   * call site.
   *
   * Asked for all active dreams rather than just the selected one, because the
   * practice picks its own dream and the weekly report counts across all of
   * them — scoping this to whatever chip happens to be selected would make the
   * practice's action depend on where somebody last tapped on Home.
   */
  const todaysActions = useTodaysActions();
  const ensureActions = useEnsureTodaysActions();
  /**
   * Asked once per visit, deliberately.
   *
   * A successful write invalidates the query, which changes the dependency,
   * which runs this again — and if the writer managed four dreams out of five,
   * the fifth is still missing, so it would ask again, and again, for as long
   * as the screen stayed open. One dream the writer cannot handle would mean an
   * unbounded loop against a paid API.
   *
   * Once per mount is the right frequency anyway: actions are a daily thing,
   * and reopening the app is what a new day looks like.
   */
  const askedForActions = useRef(false);
  useEffect(() => {
    if (askedForActions.current || !desires?.length || todaysActions.isPending) return;
    const covered = new Set((todaysActions.data ?? []).map((action) => action.desire_id));
    if (desires.every((desire) => covered.has(desire.id))) return;
    askedForActions.current = true;
    ensureActions.mutate(
      desires.map((desire) => ({
        id: desire.id,
        title: desire.title,
        category: desire.category,
        description: desire.description,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desires, todaysActions.isPending, todaysActions.data?.length]);

  /**
   * Write for a dream the moment someone selects one with nothing under it.
   *
   * The empty state offered a button, and pressing it wrote stories for two
   * other dreams — so the honest reading of the screen was that the app had
   * lost what you typed. Now selecting the chip does the work, and the button
   * below is only there for a retry.
   */
  useEffect(() => {
    if (!selectedDesireId || isPending || generate.isPending) return;
    if (storiesOnly.some((s) => s.desire_id === selectedDesireId)) return;
    generate.mutate({ perDesire: 6, desireIds: [selectedDesireId] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDesireId, isPending, storiesOnly.length]);
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

  /**
   * Add something you want, and show what happens next.
   *
   * Reported as "if I type anything in what do you want to manifest it's not
   * generating" and, separately, that a trending chip should put its text in
   * the box first. Both are the same problem, and it isn't generation —
   * checking the database, every desire added today has its six stories. The
   * work happened and nothing on screen said so.
   *
   * Three things were missing. The text vanished from the box the instant it
   * was submitted, so a trending tap looked like it went nowhere. The button
   * spinner tracked `createDesire`, which finishes in a moment, while the
   * stories take ten seconds — so the spinner stopped long before anything
   * appeared. And the new desire wasn't selected afterwards, so its six
   * stories arrived somewhere in a feed of eighteen rather than in front of
   * you.
   */
  function submitDesire(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;

    // Put it in the box, so a tap on a trending chip is visibly the same
    // action as typing it.
    setInput(trimmed);

    createDesire.mutate(
      { title: trimmed },
      {
        onSuccess: (desire) => {
          setInput("");
          // Point the feed at what was just asked for.
          setSelectedDesireId(desire.id);
          // Named explicitly. Otherwise the batch cap decides, and with several
          // dreams already saved the brand new one can lose to two older ones —
          // which is exactly what happened to "I want to buy defender car".
          generate.mutate({ perDesire: 6, desireIds: [desire.id] });
        },
      },
    );
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
          disabled={!input.trim() || createDesire.isPending || generate.isPending}
          aria-label="Add this desire"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition disabled:opacity-40"
        >
          {/* Spins until the stories exist, not until the row is inserted.
              Those are ten seconds apart, and the gap was read as nothing
              happening. */}
          {createDesire.isPending || generate.isPending ? (
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

      {/* Affirmations, above the practice and the action.
          
          Reported as "if I type what do you want to manifest it should
          generate affirmations and manifestation, why does it go to today's
          action". The answer was the running order: what you typed produced
          affirmations and stories, but the first thing that changed on screen
          was a to-do item, several sections above them.
          
          The practice and the action are habits — they're the same every day
          and they aren't a response to anything. What you just asked for
          should be what you see first. */}
      {hasDesires && (
        <AffirmationRow
          isGenerating={createDesire.isPending || generate.isPending}
          desireId={selectedDesireId ?? desires?.[0]?.id ?? null}
        />
      )}

      {/* The practice, which is the daily loop. Above the actions because it
          ends by offering them, so doing it first is the shorter path. */}
      <PracticeCard />

      {/* Always render something when a desire is selected but has nothing
          under it. This block used to be hidden while generation was running,
          and the loading spinner below only appeared when the *whole* feed was
          empty — so selecting a desire with no stories, while other desires
          had some, rendered literally nothing. That was the blank screen. */}

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
                onClick={() => generate.mutate({ perDesire: 6, desireIds: [selectedDesire.id] })}
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

      {/* Shown whenever stories are being written, not only when the feed is
          empty. With eighteen already there the empty check never fired, so
          the one moment that most needed a progress state didn't have one. */}
      {hasDesires && (isPending || generate.isPending) && (
        <div className="mt-6 flex items-center gap-3 rounded-[24px] border border-glass-border bg-card/40 px-5 py-4">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Writing your stories&hellip; this takes a few seconds.
          </p>
        </div>
      )}

      {/*
        The heading names the dream.

        "Trending for you" and "More for you" said nothing about WHICH dream,
        so a feed showing the wrong one looked like a feed showing random
        stories — there was no way to tell from the screen that a different
        dream was selected. Naming it makes the link between what you typed
        and what you're reading visible, and makes a wrong feed obviously
        wrong rather than vaguely disappointing.
      */}
      {forYou.length > 0 && (
        <CarouselSection
          label={selectedDesire ? `Written for “${selectedDesire.title}”` : "Written for you"}
        >
          {forYou.map((story) => (
            <StoryCard
              key={story.id}
              story={{
                id: story.id,
                hook: displayHook(story),
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
        <CarouselSection
          label={selectedDesire ? `More for “${selectedDesire.title}”` : "More for you"}
        >
          {trending.map((story) => (
            <StoryCard
              key={story.id}
              size="sm"
              story={{
                id: story.id,
                hook: displayHook(story),
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
          // `all`: a press rewrites every dream. Without it this rewrote the
          // day's two and left the rest of the feed identical, which reads as
          // the button having done nothing.
          onRefresh={() => generate.mutate({ perDesire: 6, all: true })}
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

  const { label, progress } = useMemo(() => {
    const target = nextRefreshAt(now);
    const remaining = Math.max(0, target.getTime() - now.getTime());
    const h = Math.floor(remaining / 3_600_000);
    const m = Math.floor((remaining % 3_600_000) / 60_000);
    const s = Math.floor((remaining % 60_000) / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      label: `${pad(h)}:${pad(m)}:${pad(s)}`,
      // Against the full window, not a hard-coded four hours — that number was
      // left behind when the refresh moved from four-hourly to daily, so the
      // bar sat at 100% almost all the time and told you nothing.
      progress: 1 - remaining / (REFRESH_HOURS * 3_600_000),
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
      {/*
        Always available, not only when the countdown hits zero.

        It used to be hidden behind `due`, which meant that for twenty-three of
        every twenty-four hours there was no way to ask for a new story at all
        — you could only watch a clock. Wanting a different story now is the
        most ordinary thing a person could want on this screen, and the app's
        answer was to show them how long they had to wait.

        Stella's reviewers complain about exactly this on their side: "the
        story sometimes takes longer than 24 hours to produce a new one, and
        sometimes it's the same as the previous day."
      */}
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
        {busy ? "Writing…" : "Write new ones now"}
      </Button>
    </section>
  );
}
