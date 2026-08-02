import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, Flame, Sparkles, Target } from "lucide-react";

import { AppPage } from "@/components/app/app-page";
import { ProgressRing } from "@/components/app/progress-ring";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoals } from "@/features/goals/use-goals";
import { useHabitStats, useToggleHabitToday } from "@/features/habits/use-habits";
import { promptForToday, useJournalEntries, useJournalStats } from "@/features/journal/use-journal";
import { useSessionUser } from "@/hooks/use-session-user";
import { toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — ManifestAI" }] }),
  component: Dashboard,
});

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { data: user } = useSessionUser();
  const { data: goals, isPending: goalsPending } = useGoals();
  const habits = useHabitStats();
  const toggleHabit = useToggleHabitToday();
  const { data: entries } = useJournalEntries();
  const journalStats = useJournalStats();

  const firstName =
    (user?.user_metadata?.["display_name"] as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "there";

  const activeGoals = goals?.filter((g) => g.status !== "achieved") ?? [];
  const focusGoal = activeGoals[0];
  const bestStreak = habits.rows.reduce((max, r) => Math.max(max, r.streak), 0);
  const journaledToday = entries?.some((e) => e.entry_date === toISODate()) ?? false;

  return (
    <AppPage
      title={`${greeting()}, ${firstName}`}
      description="Your daily overview: the goal you're moving, the habits you're keeping, and the reflection that closes the loop."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatTile
          icon={Target}
          label="Active goals"
          value={goalsPending ? "—" : String(activeGoals.length)}
          hint={focusGoal ? focusGoal.title : "Add your first goal to begin"}
        />
        <StatTile
          icon={Flame}
          label="Best habit streak"
          value={habits.isPending ? "—" : `${bestStreak}d`}
          hint={
            habits.total === 0
              ? "Streaks start on day one"
              : `${habits.completedToday} of ${habits.total} done today`
          }
        />
        <StatTile
          icon={BookOpen}
          label="Journal streak"
          value={`${journalStats.streak}d`}
          hint={journaledToday ? "Today's entry is written" : "Not written yet today"}
        />
      </div>

      {focusGoal && (
        <section className="mt-6 rounded-3xl surface-gradient p-[1.5px]">
          <div className="rounded-3xl bg-card/85 p-6 backdrop-blur-xl md:p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-ember/15 px-3 py-1 text-xs font-medium text-ember">
              <Sparkles className="h-3.5 w-3.5" /> Today's focus
            </span>
            <div className="mt-4 flex items-start justify-between gap-5">
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold leading-tight">
                  {focusGoal.title}
                </h2>
                {focusGoal.why && (
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    {focusGoal.why}
                  </p>
                )}
              </div>
              <ProgressRing value={focusGoal.progress} size={72} stroke={6} />
            </div>
            <Button variant="glass" className="mt-6" asChild>
              <Link to="/app/goals/$goalId" params={{ goalId: focusGoal.id }}>
                Open goal <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl glass-panel p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Today's habits</h2>
            {habits.total > 0 && <ProgressRing value={habits.consistency} size={44} stroke={4} />}
          </div>

          {habits.isPending && <Skeleton className="mt-4 h-32 rounded-2xl" />}

          {!habits.isPending && habits.total === 0 && (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Choose two or three habits that support your goal. This is where the daily loop
                lives.
              </p>
              <Button variant="glass" className="mt-4" asChild>
                <Link to="/app/habits">Set up habits</Link>
              </Button>
            </>
          )}

          {habits.total > 0 && (
            <ul className="mt-4 space-y-1.5">
              {habits.rows.map(({ habit, doneToday, streak }) => (
                <li key={habit.id}>
                  <button
                    type="button"
                    onClick={() => toggleHabit.mutate({ habitId: habit.id, done: !doneToday })}
                    aria-pressed={doneToday}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-accent/40"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm transition-all",
                        doneToday
                          ? "surface-gradient text-primary-foreground"
                          : "border border-border",
                      )}
                    >
                      {doneToday ? <Check className="h-4 w-4" /> : (habit.icon ?? "✨")}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        doneToday && "text-muted-foreground line-through",
                      )}
                    >
                      {habit.name}
                    </span>
                    {streak > 0 && <span className="shrink-0 text-xs text-ember">🔥 {streak}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl glass-panel p-6">
          <h2 className="font-display text-lg font-semibold">Tonight's reflection</h2>
          <p className="mt-3 text-sm font-medium leading-relaxed">{promptForToday()}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {journaledToday
              ? "You've already written today. Add another entry any time."
              : "Three minutes of writing is enough to close the loop on the day."}
          </p>
          <Button variant={journaledToday ? "glass" : "hero"} className="mt-5" asChild>
            <Link to="/app/journal">
              {journaledToday ? "Open journal" : "Write today's entry"} <ArrowRight />
            </Link>
          </Button>
        </section>
      </div>

      {!goalsPending && activeGoals.length === 0 && (
        <section className="mt-6 rounded-3xl border border-dashed border-border p-8 text-center">
          <h2 className="font-display text-xl font-semibold">Your practice is ready to set up</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Name one goal, choose two or three habits that support it, and check in each evening.
            The coach, journal and progress views fill in from there.
          </p>
          <Button variant="hero" className="mt-6" asChild>
            <Link to="/app/goals">
              Create your first goal <ArrowRight />
            </Link>
          </Button>
        </section>
      )}
    </AppPage>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl glass-panel p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/60">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
