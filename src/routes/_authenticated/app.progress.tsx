import { createFileRoute } from "@tanstack/react-router";
import { LineChart as LineChartIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppPage, EmptyState } from "@/components/app/app-page";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoals } from "@/features/goals/use-goals";
import { useHabitLogs, useHabits } from "@/features/habits/use-habits";
import { useJournalEntries } from "@/features/journal/use-journal";
import { formatDayLabel, lastNDays } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/app/progress")({
  head: () => ({ meta: [{ title: "Progress — ManifestAI" }] }),
  component: Progress,
});

const RANGE_DAYS = 30;

function Progress() {
  const { data: habits, isPending: habitsPending } = useHabits();
  const { data: logs, isPending: logsPending } = useHabitLogs();
  const { data: entries, isPending: entriesPending } = useJournalEntries();
  const { data: goals } = useGoals();

  const isPending = habitsPending || logsPending || entriesPending;

  const consistencyData = useMemo(() => {
    const habitCount = habits?.length ?? 0;
    if (habitCount === 0) return [];
    const byDate = new Map<string, number>();
    for (const log of logs ?? []) {
      byDate.set(log.date, (byDate.get(log.date) ?? 0) + 1);
    }
    return lastNDays(RANGE_DAYS).map((date) => ({
      date,
      label: formatDayLabel(date),
      consistency: Math.round(((byDate.get(date) ?? 0) / habitCount) * 100),
    }));
  }, [habits, logs]);

  const moodData = useMemo(() => {
    const byDate = new Map<string, number[]>();
    for (const entry of entries ?? []) {
      if (entry.mood == null) continue;
      byDate.set(entry.entry_date, [...(byDate.get(entry.entry_date) ?? []), entry.mood]);
    }
    return lastNDays(RANGE_DAYS)
      .map((date) => {
        const moods = byDate.get(date);
        return {
          date,
          label: formatDayLabel(date),
          mood: moods ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
        };
      })
      .filter((d) => d.mood !== null);
  }, [entries]);

  const totalLogs = logs?.length ?? 0;
  const hasAnything = totalLogs > 0 || moodData.length > 0;

  const avgConsistency =
    consistencyData.length > 0
      ? Math.round(
          consistencyData.reduce((sum, d) => sum + d.consistency, 0) / consistencyData.length,
        )
      : 0;

  const avgMood =
    moodData.length > 0
      ? (moodData.reduce((sum, d) => sum + (d.mood ?? 0), 0) / moodData.length).toFixed(1)
      : "—";

  const goalProgress =
    goals && goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0;

  if (isPending) {
    return (
      <AppPage
        title="Progress"
        description="Goal milestones, habit consistency and check-in trends over time."
      >
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="Progress"
      description="Goal milestones, habit consistency and check-in trends over time."
    >
      {!hasAnything ? (
        <EmptyState
          icon={LineChartIcon}
          title="Not enough data yet"
          body="After about a week of check-ins your trends appear here — habit consistency, mood and goal movement."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Avg. consistency" value={`${avgConsistency}%`} sub="Last 30 days" />
            <Metric label="Avg. mood" value={String(avgMood)} sub="Out of 5" />
            <Metric label="Goal progress" value={`${goalProgress}%`} sub="Across all goals" />
          </div>

          {consistencyData.length > 0 && (
            <ChartCard
              title="Habit consistency"
              caption="Share of your habits completed each day, over the last 30 days."
            >
              <AreaChart data={consistencyData}>
                <defs>
                  <linearGradient id="consistencyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip suffix="%" />} />
                <Area
                  type="monotone"
                  dataKey="consistency"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#consistencyFill)"
                />
              </AreaChart>
            </ChartCard>
          )}

          {moodData.length > 1 && (
            <ChartCard
              title="Mood"
              caption="Average mood from your journal entries. Only days you wrote appear."
            >
              <LineChart data={moodData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke="var(--violet)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--violet)" }}
                />
              </LineChart>
            </ChartCard>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            These are descriptive trends from what you've logged — a mirror, not a prediction.
          </p>
        </>
      )}
    </AppPage>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl glass-panel p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactElement;
}) {
  return (
    <section className="mt-4 rounded-3xl glass-panel p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
      <div className="mt-5 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean | undefined;
  payload?: { value: number }[] | undefined;
  label?: string | undefined;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-sm font-semibold">
        {typeof value === "number" ? value.toFixed(suffix ? 0 : 1) : "—"}
        {suffix}
      </p>
    </div>
  );
}
