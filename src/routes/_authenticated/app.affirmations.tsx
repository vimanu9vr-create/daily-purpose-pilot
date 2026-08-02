import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Loader2, Pause, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { AFFIRMATION_CATEGORIES } from "@/features/affirmations/affirmation-library";
import {
  useAffirmationDeck,
  useGenerateAffirmations,
  useSaveAffirmation,
  useSavedAffirmations,
} from "@/features/affirmations/use-affirmations";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/affirmations")({
  head: () => ({ meta: [{ title: "Affirmations — ManifestAI" }] }),
  component: Affirmations,
});

function Affirmations() {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const deck = useAffirmationDeck(categoryId);
  const { data: saved } = useSavedAffirmations();
  const saveAffirmation = useSaveAffirmation();
  const generate = useGenerateAffirmations();
  const speech = useSpeech();

  const current = deck[index];
  const savedTexts = useMemo(() => new Set((saved ?? []).map((a) => a.text)), [saved]);
  const isSaved = current ? savedTexts.has(current.text) : false;

  // Changing category restarts the deck.
  useEffect(() => {
    setIndex(0);
  }, [categoryId]);

  // Never leave the voice running when the card changes.
  useEffect(() => {
    speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, categoryId]);

  function go(step: number) {
    if (deck.length === 0) return;
    setDirection(step);
    setIndex((i) => (i + step + deck.length) % deck.length);
  }

  // Arrow keys feel natural on a card deck.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.length]);

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 text-center">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Affirmations</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Present-tense statements to rehearse who you're being today. Swipe through, keep the
            ones that land.
          </p>
        </header>

        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
              categoryId === null
                ? "border-transparent surface-gradient text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent/50",
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
                "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                categoryId === category.id
                  ? "border-transparent surface-gradient text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent/50",
              )}
            >
              <span className="mr-1">{category.emoji}</span>
              {category.label}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-4xl surface-gradient p-[1.5px] shadow-lift">
          <div className="relative min-h-[340px] overflow-hidden rounded-4xl bg-card/90 backdrop-blur-xl md:min-h-[400px]">
            <div className="aurora-mesh pointer-events-none absolute inset-0 opacity-50" />

            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={current?.id ?? "empty"}
                custom={direction}
                initial={{ opacity: 0, x: direction * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -60 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -70) go(1);
                  else if (info.offset.x > 70) go(-1);
                }}
                className="relative flex min-h-[340px] cursor-grab flex-col items-center justify-center px-8 py-14 text-center active:cursor-grabbing md:min-h-[400px] md:px-16"
              >
                <p className="font-display text-2xl font-semibold leading-snug tracking-tight md:text-4xl md:leading-tight">
                  {current?.text ?? "No affirmations here yet."}
                </p>
                {current && (
                  <span className="mt-6 rounded-full bg-accent/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {AFFIRMATION_CATEGORIES.find((c) => c.id === current.category)?.label ??
                      current.category}
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          <Button variant="glass" size="icon" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft />
          </Button>

          {speech.isSupported && current && (
            <Button
              variant="glass"
              size="icon"
              onClick={() => speech.toggle(current.text)}
              aria-label={speech.isSpeaking ? "Stop reading" : "Read aloud"}
            >
              {speech.isSpeaking ? <Pause /> : <Volume2 />}
            </Button>
          )}

          <Button
            variant={isSaved ? "glass" : "hero"}
            onClick={() =>
              current &&
              !isSaved &&
              saveAffirmation.mutate({ text: current.text, category: current.category })
            }
            disabled={!current || isSaved || saveAffirmation.isPending}
          >
            <Heart className={cn("h-4 w-4", isSaved && "fill-current text-ember")} />
            {isSaved ? "Saved" : "Save"}
          </Button>

          <Button variant="glass" size="icon" onClick={() => go(1)} aria-label="Next">
            <ChevronRight />
          </Button>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          {deck.length > 0 ? `${index + 1} of ${deck.length}` : "—"}
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          swipe or use arrow keys
        </p>

        <section className="mt-10 rounded-3xl glass-panel p-6 text-center">
          <h2 className="font-display text-lg font-semibold">Write these from my own goals</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Generates affirmations in your own words, using the goals and obstacles you've already
            written down — rather than generic ones.
          </p>
          <Button
            variant="hero"
            className="mt-5"
            onClick={() => generate.mutate({ categoryId })}
            disabled={generate.isPending}
          >
            {generate.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Generate for me
          </Button>
        </section>
      </div>
    </PageTransition>
  );
}
