import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";

import { isReviewDay, useWeeklySummary } from "./use-weekly";

/**
 * The pointer to the weekly report, on Home.
 *
 * Hidden until there's something to report. A "0 practices this week" card on
 * a Tuesday morning is an accusation, and the first week of using an app is
 * exactly when someone is deciding whether it makes them feel better or worse.
 *
 * Louder on Sunday, because that's when reviewing is worth doing and when a
 * prompt is welcome rather than an interruption.
 */
export function WeekCard() {
  const { data: summary } = useWeeklySummary();

  if (!summary) return null;
  if (summary.practices === 0 && summary.actionsCompleted === 0) return null;

  const sunday = isReviewDay();

  return (
    <Link
      to="/app/week"
      className="mt-6 flex items-center gap-4 rounded-[28px] border border-glass-border bg-card/50 px-5 py-4 transition active:scale-[0.99]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <CalendarDays className="h-4 w-4 text-primary" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">
          {sunday ? "Your week, and a few questions" : "Your week so far"}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {summary.practices} {summary.practices === 1 ? "practice" : "practices"} ·{" "}
          {summary.actionsCompleted} done · {summary.minutes} min
        </span>
      </span>

      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
