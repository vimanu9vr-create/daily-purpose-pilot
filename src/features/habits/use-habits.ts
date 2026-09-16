import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDesires } from "@/features/stories/use-stories";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentStreak, lastNDays, toISODate } from "@/lib/dates";

export type Habit = Database["public"]["Tables"]["habits"]["Row"];
export type HabitLog = Database["public"]["Tables"]["habit_logs"]["Row"];

export const HABIT_SUGGESTIONS = [
  { name: "Meditation", icon: "🧘" },
  { name: "Exercise", icon: "🏃" },
  { name: "Reading", icon: "📚" },
  { name: "Gratitude", icon: "🙏" },
  { name: "Visualization", icon: "✨" },
] as const;

export const HABIT_ICONS = [
  "✨",
  "🧘",
  "🏃",
  "📚",
  "🙏",
  "💧",
  "😴",
  "🥗",
  "✍️",
  "🎯",
  "💪",
  "🎧",
  "🌱",
  "☀️",
] as const;

export const habitKeys = {
  all: ["habits"] as const,
  logs: ["habit-logs"] as const,
};

/** How far back streaks and the week strip look. */
const LOG_WINDOW_DAYS = 120;

export function useHabits() {
  const userId = useUserId();
  return useQuery({
    queryKey: habitKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useHabitLogs() {
  const userId = useUserId();
  return useQuery({
    queryKey: habitKeys.logs,
    enabled: Boolean(userId),
    queryFn: async () => {
      const since = lastNDays(LOG_WINDOW_DAYS)[0]!;
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("date", since)
        .eq("completed", true);
      if (error) throw error;
      return data;
    },
  });
}

/** Derived per-habit stats: today's state, streak, and the last 7 days. */
export function useHabitStats() {
  const habits = useHabits();
  const logs = useHabitLogs();
  const desires = useDesires();
  const today = toISODate();
  const week = lastNDays(7);

  const byHabit = new Map<string, Set<string>>();
  for (const log of logs.data ?? []) {
    const set = byHabit.get(log.habit_id) ?? new Set<string>();
    set.add(log.date);
    byHabit.set(log.habit_id, set);
  }

  const titleByDesire = new Map((desires.data ?? []).map((d) => [d.id, d.title]));

  const rows = (habits.data ?? []).map((habit) => {
    const dates = byHabit.get(habit.id) ?? new Set<string>();
    return {
      habit,
      /**
       * What this habit is FOR. Null when it serves no particular desire, or
       * when the desire it served has since been deleted — the habit outlives
       * it rather than vanishing with it, so the streak survives.
       */
      desireTitle: habit.desire_id ? (titleByDesire.get(habit.desire_id) ?? null) : null,
      dates,
      doneToday: dates.has(today),
      streak: currentStreak(dates),
      week: week.map((date) => ({ date, done: dates.has(date) })),
    };
  });

  const completedToday = rows.filter((r) => r.doneToday).length;
  const consistency = rows.length === 0 ? 0 : (completedToday / rows.length) * 100;

  return {
    rows,
    completedToday,
    total: rows.length,
    consistency,
    desires: desires.data ?? [],
    isPending: habits.isPending || logs.isPending,
    error: habits.error ?? logs.error,
  };
}

export function useCreateHabit() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      icon,
      targetPerWeek,
      desireId,
    }: {
      name: string;
      icon: string;
      targetPerWeek: number;
      /** Which dream this habit serves. Null is allowed and means "just a habit". */
      desireId?: string | null;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("habits").insert({
        user_id: userId,
        name,
        icon,
        target_per_week: targetPerWeek,
        desire_id: desireId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: habitKeys.all }),
    onError: (error: Error) => toast.error(error.message || "Couldn't add that habit"),
  });
}

/**
 * Move a habit to a different dream, or detach it entirely.
 *
 * Kept separate from archiving because the two are opposites: this preserves
 * the habit and its whole log, and only changes what it is understood to be
 * for.
 */
export function useSetHabitDesire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, desireId }: { habitId: string; desireId: string | null }) => {
      const { error } = await supabase
        .from("habits")
        .update({ desire_id: desireId })
        .eq("id", habitId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: habitKeys.all }),
    onError: (error: Error) => toast.error(error.message || "Couldn't move that habit"),
  });
}

export function useArchiveHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (habitId: string) => {
      const { error } = await supabase.from("habits").update({ active: false }).eq("id", habitId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Habit archived");
      void queryClient.invalidateQueries({ queryKey: habitKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't archive that habit"),
  });
}

export function useToggleHabitToday() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const today = toISODate();

  return useMutation({
    mutationFn: async ({ habitId, done }: { habitId: string; done: boolean }) => {
      if (!userId) throw new Error("Not signed in");

      if (done) {
        // Unique on (habit_id, date), so upsert keeps repeat taps idempotent.
        const { error } = await supabase
          .from("habit_logs")
          .upsert(
            { habit_id: habitId, user_id: userId, date: today, completed: true },
            { onConflict: "habit_id,date" },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("habit_logs")
          .delete()
          .eq("habit_id", habitId)
          .eq("date", today);
        if (error) throw error;
      }
    },
    onMutate: async ({ habitId, done }) => {
      await queryClient.cancelQueries({ queryKey: habitKeys.logs });
      const previous = queryClient.getQueryData<HabitLog[]>(habitKeys.logs);

      queryClient.setQueryData<HabitLog[]>(habitKeys.logs, (old = []) =>
        done
          ? [
              ...old,
              {
                id: `optimistic-${habitId}`,
                habit_id: habitId,
                user_id: userId ?? "",
                date: today,
                completed: true,
                created_at: new Date().toISOString(),
              },
            ]
          : old.filter((l) => !(l.habit_id === habitId && l.date === today)),
      );

      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(habitKeys.logs, context.previous);
      toast.error(error.message || "Couldn't update that habit");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: habitKeys.logs }),
  });
}
