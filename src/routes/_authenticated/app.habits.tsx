import { createFileRoute } from "@tanstack/react-router";
import { Check, Flame, Plus, X } from "lucide-react";
import { useState } from "react";

import { AppPage } from "@/components/app/app-page";
import { ProgressRing } from "@/components/app/progress-ring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HABIT_ICONS,
  HABIT_SUGGESTIONS,
  useArchiveHabit,
  useCreateHabit,
  useHabitStats,
  useToggleHabitToday,
} from "@/features/habits/use-habits";
import { formatDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/habits")({
  head: () => ({ meta: [{ title: "Habits — ManifestAI" }] }),
  component: Habits,
});

function Habits() {
  const { rows, completedToday, total, consistency, isPending, error } = useHabitStats();
  const toggle = useToggleHabitToday();
  const createHabit = useCreateHabit();
  const archiveHabit = useArchiveHabit();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string>(HABIT_ICONS[0]);
  const [targetPerWeek, setTargetPerWeek] = useState(7);

  function submitHabit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createHabit.mutate(
      { name: trimmed, icon, targetPerWeek },
      {
        onSuccess: () => {
          setName("");
          setIcon(HABIT_ICONS[0]);
          setTargetPerWeek(7);
          setAdding(false);
        },
      },
    );
  }

  return (
    <AppPage
      title="Habits"
      description="Small, repeatable actions with weekly targets. Consistency beats intensity."
    >
      {isPending && <Skeleton className="h-72 rounded-3xl" />}

      {error && (
        <div className="rounded-3xl glass-panel p-6 text-sm text-destructive">
          Couldn't load your habits. {error.message}
        </div>
      )}

      {!isPending && !error && (
        <>
          <section className="flex items-center gap-6 rounded-3xl glass-panel p-6">
            <ProgressRing
              value={consistency}
              size={104}
              stroke={8}
              sublabel={total > 0 ? `${completedToday}/${total}` : undefined}
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">Today's consistency</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {total === 0
                  ? "Add a couple of habits and this becomes the number you check each morning."
                  : completedToday === total
                    ? "Every habit done today. That's the whole game."
                    : `${total - completedToday} left today. Partial credit still counts.`}
              </p>
            </div>
          </section>

          {total === 0 && (
            <section className="mt-6 rounded-3xl glass-panel p-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl surface-gradient shadow-glow">
                <Flame className="h-6 w-6 text-primary-foreground" />
              </span>
              <h2 className="mt-6 font-display text-xl font-semibold">No habits tracked yet</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Choose two or three habits that directly support your goal. Weekly targets leave
                room for the days life gets in the way.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {HABIT_SUGGESTIONS.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    disabled={createHabit.isPending}
                    onClick={() =>
                      createHabit.mutate({ name: s.name, icon: s.icon, targetPerWeek: 7 })
                    }
                    className="rounded-2xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 disabled:opacity-50"
                  >
                    <span className="mr-1.5">{s.icon}</span>
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {total > 0 && (
            <ul className="mt-6 space-y-3">
              {rows.map(({ habit, doneToday, streak, week }) => (
                <li
                  key={habit.id}
                  className="group flex items-center gap-4 rounded-3xl glass-panel p-4"
                >
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ habitId: habit.id, done: !doneToday })}
                    aria-pressed={doneToday}
                    aria-label={`Mark ${habit.name} ${doneToday ? "not done" : "done"} today`}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg transition-all duration-200",
                      doneToday
                        ? "surface-gradient text-primary-foreground shadow-glow"
                        : "border border-border text-foreground hover:bg-accent/50",
                    )}
                  >
                    {doneToday ? <Check className="h-5 w-5" /> : (habit.icon ?? "✨")}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{habit.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {streak > 0 ? (
                        <span className="text-ember">
                          🔥 {streak} day{streak === 1 ? "" : "s"}
                        </span>
                      ) : (
                        "No streak yet"
                      )}
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      {habit.target_per_week}× per week
                    </p>
                  </div>

                  <div className="hidden items-end gap-1 sm:flex" aria-hidden>
                    {week.map(({ date, done }) => (
                      <div key={date} className="flex flex-col items-center gap-1">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full transition-colors",
                            done ? "surface-gradient" : "bg-muted",
                          )}
                        />
                        <span className="text-[9px] text-muted-foreground/60">
                          {formatDayLabel(date)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => archiveHabit.mutate(habit.id)}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Archive ${habit.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <section className="mt-6">
            {adding ? (
              <div className="rounded-3xl glass-panel p-5">
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitHabit()}
                    placeholder="Habit name — e.g. Morning pages"
                  />
                  <Button onClick={submitHabit} disabled={!name.trim() || createHabit.isPending}>
                    Add
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setAdding(false)}>
                    <X />
                  </Button>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Icon</p>
                  <div className="flex flex-wrap gap-1.5">
                    {HABIT_ICONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setIcon(option)}
                        className={cn(
                          "h-9 w-9 rounded-xl text-base transition-colors",
                          icon === option
                            ? "surface-gradient shadow-glow"
                            : "border border-border hover:bg-accent/50",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Target — {targetPerWeek}× per week
                  </p>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setTargetPerWeek(n)}
                        className={cn(
                          "h-9 w-9 rounded-xl text-sm font-medium transition-colors",
                          targetPerWeek === n
                            ? "surface-gradient text-primary-foreground"
                            : "border border-border hover:bg-accent/50",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Button variant="glass" onClick={() => setAdding(true)}>
                <Plus /> Add habit
              </Button>
            )}
          </section>
        </>
      )}
    </AppPage>
  );
}
