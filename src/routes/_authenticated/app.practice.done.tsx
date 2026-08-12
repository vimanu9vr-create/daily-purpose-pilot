import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/page-transition";
import { useTodaysActions } from "@/features/actions/use-actions";
import { usePracticeStreak, useTodaysPractice } from "@/features/practice/use-practice";

export const Route = createFileRoute("/_authenticated/app/practice/done")({
  head: () => ({ meta: [{ title: "Practice complete — ManifestAI" }] }),
  component: PracticeDone,
});

/**
 * The completion screen.
 *
 * Kept quiet on purpose. Confetti and "AMAZING WORK!!" would undercut the one
 * claim this app is careful about: that showing up repeatedly is what does the
 * work, not any single session. Overselling four minutes teaches people that
 * the four minutes was the achievement.
 *
 * The streak is shown but not made load-bearing, and it never scolds — a
 * missed day is simply a smaller number, with no language about breaking or
 * losing anything.
 */
function PracticeDone() {
  const streak = usePracticeStreak();
  const { data: session } = useTodaysPractice();
  const { data: actions } = useTodaysActions();

  const minutes = Math.max(1, Math.round((session?.seconds ?? 0) / 60));
  const pending = (actions ?? []).filter((action) => !action.completed_at);

  return (
    <PageTransition>
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-16 w-16 items-center justify-center rounded-full surface-gradient shadow-glow"
        >
          <Check className="h-7 w-7 text-primary-foreground" />
        </motion.span>

        <h1 className="mt-7 font-display text-[28px] leading-tight">That&rsquo;s today done.</h1>

        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {minutes} {minutes === 1 ? "minute" : "minutes"}
          {streak > 1 ? `, ${streak} days in a row.` : "."}{" "}
          {streak > 1
            ? "The repetition is the part that works."
            : "Come back tomorrow and it starts to count for something."}
        </p>

        {pending.length > 0 && (
          <div className="mt-9 w-full max-w-sm rounded-[28px] border border-glass-border bg-card/60 p-5 text-left">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Still waiting on you
            </p>
            <p className="mt-2 text-pretty text-[15px] leading-relaxed">{pending[0]!.body}</p>
          </div>
        )}

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          <Button asChild variant="hero" size="lg" className="rounded-full">
            <Link to="/app">Back to home</Link>
          </Button>
          <Button asChild variant="glass" size="lg" className="rounded-full">
            <Link to="/app/journal">Write a little more</Link>
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
