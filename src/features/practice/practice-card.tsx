import { Link } from "@tanstack/react-router";
import { Check, Flame, Play } from "lucide-react";

import { usePracticePlan, usePracticeStreak, useTodaysPractice } from "./use-practice";

/**
 * The invitation to practise, on Home.
 *
 * Two states, and the difference between them matters. Before: a clear
 * primary action with the real length on it, because "5 minutes" is what
 * decides whether someone taps at 7am. After: no second invitation, no "go
 * again" — the session is once a day and pretending otherwise would turn a
 * practice into a scoreboard.
 *
 * The streak appears only once it's worth something. A "1 day streak" on day
 * one is a participation trophy, and it makes day two feel like an obligation
 * rather than a choice.
 */
export function PracticeCard() {
  const plan = usePracticePlan();
  const streak = usePracticeStreak();
  const { data: today, isPending } = useTodaysPractice();

  if (isPending) return null;

  const minutes = Math.max(1, Math.round(plan.totalSeconds / 60));

  if (today) {
    return (
      <section className="mt-6 flex items-center gap-3 rounded-[28px] border border-glass-border bg-card/40 px-5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Check className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">Today&rsquo;s practice is done.</p>
          {streak > 1 && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flame className="h-3 w-3" /> {streak} days in a row
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] surface-gradient p-[1.5px] shadow-lift">
      <div className="rounded-[27px] bg-card/85 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Your daily practice
            </p>
            <p className="mt-1 font-display text-[20px] leading-tight">
              {minutes} {minutes === 1 ? "minute" : "minutes"}, {plan.steps.length} steps
            </p>
          </div>
          {streak > 1 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
              <Flame className="h-3 w-3" /> {streak}
            </span>
          )}
        </div>

        <Link
          to="/app/practice"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full surface-gradient px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow transition active:scale-[0.98]"
        >
          <Play className="h-4 w-4" />
          Start today&rsquo;s practice
        </Link>
      </div>
    </section>
  );
}
