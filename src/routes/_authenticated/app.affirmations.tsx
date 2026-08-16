import { Link, createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Heart, Loader2, Pause, Share2, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { AFFIRMATION_CATEGORIES } from "@/features/affirmations/affirmation-library";
import { DraggableRow } from "@/features/stories/story-card";
import {
  useAffirmationDeck,
  useGenerateAffirmations,
  useSaveAffirmation,
  useSavedAffirmations,
} from "@/features/affirmations/use-affirmations";
import { programmeProgress, type ProgrammeLength } from "@/features/programmes/programme-plan";
import { useProgrammeDays, useProgrammes } from "@/features/programmes/use-programmes";
import { useSpokenLine } from "@/hooks/use-spoken-line";
import { haptic, hapticSuccess, share as nativeShare } from "@/lib/native";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/affirmations")({
  head: () => ({ meta: [{ title: "Affirmations — ManifestAI" }] }),
  component: Affirmations,
});

function Affirmations() {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showFavorites, setShowFavorites] = useState(false);

  const deck = useAffirmationDeck(categoryId);
  const { data: saved } = useSavedAffirmations();
  const saveAffirmation = useSaveAffirmation();
  const generate = useGenerateAffirmations();
  const speech = useSpokenLine();

  const savedTexts = useMemo(() => new Set((saved ?? []).map((a) => a.text)), [saved]);
  const visible = showFavorites ? deck.filter((a) => savedTexts.has(a.text)) : deck;
  const current = visible[index];
  const isSaved = current ? savedTexts.has(current.text) : false;

  useEffect(() => {
    setIndex(0);
  }, [categoryId, showFavorites]);

  useEffect(() => {
    speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, categoryId]);

  function go(step: number) {
    if (visible.length === 0) return;
    setDirection(step);
    setIndex((i) => (i + step + visible.length) % visible.length);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length]);

  const categoryLabel =
    AFFIRMATION_CATEGORIES.find((c) => c.id === current?.category)?.label ??
    current?.category ??
    "";

  return (
    <PageTransition>
      <ProgrammeEntry />

      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[32px] font-medium leading-none">Affirmations</h1>
          <p className="eyebrow mt-2 text-muted-foreground">Come back once daily</p>
        </div>
        <button
          type="button"
          onClick={() => setShowFavorites((f) => !f)}
          aria-label={showFavorites ? "Show all" : "Show saved only"}
          aria-pressed={showFavorites}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition",
            showFavorites ? "bg-primary text-primary-foreground" : "bg-white/70 text-primary",
          )}
        >
          <Heart className={cn("h-4 w-4", showFavorites && "fill-current")} />
        </button>
      </header>

      <DraggableRow className="mt-5 pb-1">
        <button
          type="button"
          onClick={() => setCategoryId(null)}
          className={cn(
            "carousel-item rounded-full px-4 py-2 text-xs font-medium transition",
            categoryId === null
              ? "bg-primary text-primary-foreground"
              : "bg-white/60 text-muted-foreground",
          )}
        >
          All
        </button>
        {AFFIRMATION_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setCategoryId(category.id)}
            className={cn(
              "carousel-item rounded-full px-4 py-2 text-xs font-medium transition",
              categoryId === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-white/60 text-muted-foreground",
            )}
          >
            {category.emoji} {category.label}
          </button>
        ))}
      </DraggableRow>

      {/* Card stack */}
      <div className="relative mt-8 h-[420px]">
        {/* Stacked edges peeking out beneath */}
        <div className="absolute inset-x-6 bottom-0 h-[380px] translate-y-3 rounded-4xl bg-card/50 shadow-card" />
        <div className="absolute inset-x-3 bottom-0 h-[390px] translate-y-1.5 rounded-4xl bg-card/75 shadow-card" />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current?.id ?? "empty"}
            initial={{ opacity: 0, x: direction * 50, rotate: direction * 1.5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, x: direction * -50, rotate: direction * -1.5 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70) go(1);
              else if (info.offset.x > 70) go(-1);
            }}
            className="absolute inset-0 flex cursor-grab flex-col items-center justify-center rounded-4xl bg-card px-8 text-center shadow-lift active:cursor-grabbing"
          >
            {current && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isSaved) return;
                    void hapticSuccess();
                    saveAffirmation.mutate({ text: current.text, category: current.category });
                  }}
                  aria-label={isSaved ? "Saved" : "Save this affirmation"}
                  className="absolute left-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-accent/60 text-primary transition hover:bg-accent"
                >
                  <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await haptic("light");
                    const shared = await nativeShare({ text: current.text });
                    if (!shared) toast.error("Couldn't share that.");
                  }}
                  aria-label="Share"
                  className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-accent/60 text-primary transition hover:bg-accent"
                >
                  <Share2 className="h-4 w-4" />
                </button>

                <p className="font-display text-[26px] italic leading-[1.35] md:text-[30px]">
                  {current.text}
                </p>
                <p className="eyebrow mt-7 text-muted-foreground">{categoryLabel}</p>

                {speech.isSupported && (
                  <button
                    type="button"
                    onClick={() => speech.toggle(current.text)}
                    className="absolute bottom-6 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105"
                    aria-label={speech.isSpeaking ? "Stop" : "Read aloud"}
                  >
                    {speech.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : speech.isSpeaking ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </>
            )}

            {!current && (
              <p className="text-sm text-muted-foreground">
                {showFavorites
                  ? "Nothing saved yet — tap the heart on one you like."
                  : "No affirmations here yet."}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {visible.length > 0 ? `${index + 1} of ${visible.length}` : "—"}
        <span className="mx-1.5 text-muted-foreground/40">·</span>
        swipe for the next
      </p>

      <div className="mt-8 text-center">
        <Button
          variant="glass"
          className="rounded-full"
          onClick={() => generate.mutate({ categoryId })}
          disabled={generate.isPending}
        >
          {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Write these from my own desires
        </Button>
      </div>
    </PageTransition>
  );
}

/**
 * The way into programmes.
 *
 * Placed on the affirmations screen rather than given its own tab. Five is
 * already as many as a bottom bar can carry without becoming a menu, and a
 * programme is a run of affirmations — this is where somebody would look for
 * it. If it turns out to be the thing people open the app for, it earns a tab
 * then, on evidence rather than on a guess.
 */
function ProgrammeEntry() {
  const { data: programmes } = useProgrammes();
  const { data: days } = useProgrammeDays((programmes ?? []).find((p) => !p.completed_at)?.id);

  const active = (programmes ?? []).find((p) => !p.completed_at);

  if (!active) {
    return (
      <Link
        to="/app/programmes"
        className="mb-6 flex items-center justify-between gap-3 rounded-[24px] border border-glass-border bg-card/50 px-5 py-4 transition hover:bg-card/70"
      >
        <div>
          <p className="font-display text-[17px]">Start a 7 or 21 day programme</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            A run of days on one thing you want.
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  const done = (days ?? []).filter((day) => day.completed_at).length;
  const progress = programmeProgress(done, active.length_days as ProgrammeLength);

  return (
    <Link
      to="/app/programme/$programmeId"
      params={{ programmeId: active.id }}
      className="mb-6 block rounded-[24px] surface-gradient p-[1px]"
    >
      <div className="rounded-[23px] bg-card/85 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground">
              Day {progress.current} of {active.length_days}
            </p>
            <p className="mt-1 truncate font-display text-[17px]">{active.title}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
