import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart, Loader2, Pause, RefreshCw, Sparkles, Trash2, Volume2 } from "lucide-react";
import { useState } from "react";

import { PageTransition } from "@/components/page-transition";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoals } from "@/features/goals/use-goals";
import {
  momentTemplateCount,
  useCreateTodaysMoment,
  useDeleteMoment,
  useMarkListened,
  useMoments,
  useToggleMomentFavorite,
  useTodaysMoment,
} from "@/features/moments/use-moments";
import { useSpeech } from "@/hooks/use-speech";
import { formatLongDate, toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/moments")({
  head: () => ({ meta: [{ title: "Moments — ManifestAI" }] }),
  component: Moments,
});

function Moments() {
  const { data: today, isPending } = useTodaysMoment();
  const { data: all } = useMoments();
  const { data: goals } = useGoals();
  const createMoment = useCreateTodaysMoment();
  const toggleFavorite = useToggleMomentFavorite();
  const markListened = useMarkListened();
  const deleteMoment = useDeleteMoment();
  const speech = useSpeech();

  const [variant, setVariant] = useState(0);

  const hasGoal = (goals?.length ?? 0) > 0;
  const past = (all ?? []).filter((m) => m.moment_date !== toISODate());

  function listen() {
    if (!today) return;
    if (speech.isSpeaking) {
      speech.stop();
      return;
    }
    speech.speak(`${today.title}. ${today.body}`);
    markListened.mutate(today.id);
  }

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 text-center">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Today's moment</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            A short scene written from your own goal, in present tense. Read it or listen to it,
            then go do the small piece of it that today allows.
          </p>
        </header>

        {isPending && <Skeleton className="h-80 rounded-4xl" />}

        {!isPending && !hasGoal && (
          <section className="rounded-4xl glass-panel px-8 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl surface-gradient shadow-glow">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </span>
            <h2 className="mt-6 font-display text-xl font-semibold">
              Your moment is written from your goal
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Name one thing you're working toward and why it matters. Everything here is built from
              your own words.
            </p>
            <Button variant="hero" className="mt-6" asChild>
              <Link to="/app/goals">Create your first goal</Link>
            </Button>
          </section>
        )}

        {!isPending && hasGoal && !today && (
          <section className="rounded-4xl glass-panel px-8 py-14 text-center">
            <h2 className="font-display text-xl font-semibold">Today's moment is waiting</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              It takes about a minute to read. Best done before the day gets loud.
            </p>
            <Button
              variant="hero"
              size="lg"
              className="mt-6"
              onClick={() => createMoment.mutate({})}
              disabled={createMoment.isPending}
            >
              {createMoment.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Create today's moment
            </Button>
          </section>
        )}

        {today && (
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="overflow-hidden rounded-4xl surface-gradient p-[1.5px] shadow-lift"
          >
            <div className="relative rounded-4xl bg-card/90 p-7 backdrop-blur-xl md:p-10">
              <div className="aurora-mesh pointer-events-none absolute inset-0 opacity-40" />

              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
                  <Sparkles className="h-3.5 w-3.5" />
                  {formatLongDate(today.moment_date)}
                </span>

                <h2 className="mt-4 font-display text-2xl font-semibold leading-tight md:text-3xl">
                  {today.title}
                </h2>

                <div className="mt-6 space-y-4">
                  {today.body.split("\n\n").map((paragraph, i) => (
                    <p
                      key={i}
                      className="text-[15px] leading-[1.75] text-foreground/90 md:text-base"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-2">
                  {speech.isSupported && (
                    <Button variant="hero" onClick={listen}>
                      {speech.isSpeaking ? <Pause /> : <Volume2 />}
                      {speech.isSpeaking ? "Stop" : "Listen"}
                    </Button>
                  )}

                  <Button
                    variant="glass"
                    onClick={() =>
                      toggleFavorite.mutate({ id: today.id, isFavorite: !today.is_favorite })
                    }
                  >
                    <Heart
                      className={cn("h-4 w-4", today.is_favorite && "fill-current text-ember")}
                    />
                    {today.is_favorite ? "Saved" : "Save"}
                  </Button>

                  <Button
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={createMoment.isPending}
                    onClick={() => {
                      const next = (variant + 1) % momentTemplateCount();
                      setVariant(next);
                      speech.stop();
                      createMoment.mutate({ variant: next });
                    }}
                  >
                    {createMoment.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Different one
                  </Button>
                </div>
              </div>
            </div>
          </motion.article>
        )}

        {past.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Earlier moments
            </h2>
            <ul className="space-y-2.5">
              {past.map((moment) => (
                <li key={moment.id} className="group rounded-2xl glass-panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium">{moment.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatLongDate(moment.moment_date)}
                        </span>
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {moment.body}
                      </p>
                    </div>
                    {moment.is_favorite && (
                      <Heart className="h-4 w-4 shrink-0 fill-current text-ember" />
                    )}
                    <button
                      type="button"
                      onClick={() => deleteMoment.mutate(moment.id)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                      aria-label={`Delete ${moment.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
          These are focus and rehearsal exercises. Picturing something clearly helps you notice
          chances to act on it — it doesn't make it arrive on its own.
        </p>
      </div>
    </PageTransition>
  );
}
