import { useQuery } from "@tanstack/react-query";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";

import { computeAchievements, type Achievement } from "./achievements";

/**
 * Achievements, computed from the rows that already exist.
 *
 * No `achievements` table and no unlock event, on purpose. Storing them would
 * need a job to award them, a notification to announce them, and a decision
 * about what happens when someone deletes the data underneath one. Counting is
 * a single round trip and can never disagree with reality.
 */
export function useAchievements() {
  const userId = useUserId();

  return useQuery({
    queryKey: ["achievements"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Achievement[]> => {
      const [practices, actions, milestones, journals, boards] = await Promise.all([
        supabase.from("practice_sessions").select("for_date"),
        supabase.from("actions").select("id").not("completed_at", "is", null),
        supabase.from("milestones").select("desire_id,completed_at"),
        supabase.from("journals").select("id"),
        supabase.from("vision_boards").select("id"),
      ]);

      const days = (practices.data ?? []).map((row) => row.for_date);
      const milestoneRows = milestones.data ?? [];

      // A desire counts as complete when every one of its steps is ticked and
      // it has at least one — otherwise a desire with no plan would qualify
      // for "something finished" the moment it was created.
      const byDesire = new Map<string, { total: number; done: number }>();
      for (const row of milestoneRows) {
        const entry = byDesire.get(row.desire_id) ?? { total: 0, done: 0 };
        entry.total += 1;
        if (row.completed_at) entry.done += 1;
        byDesire.set(row.desire_id, entry);
      }
      const goalsCompleted = [...byDesire.values()].filter(
        (entry) => entry.total > 0 && entry.done === entry.total,
      ).length;

      return computeAchievements({
        practices: days.length,
        practiceDays: new Set(days).size,
        actionsCompleted: actions.data?.length ?? 0,
        milestonesCompleted: milestoneRows.filter((row) => row.completed_at).length,
        goalsCompleted,
        journalEntries: journals.data?.length ?? 0,
        boards: boards.data?.length ?? 0,
        longestStreak: longestRun(days),
      });
    },
  });
}

/**
 * The longest run of consecutive days, ever.
 *
 * Longest rather than current, because an achievement should record something
 * that happened. Tying it to the current streak would mean a missed Tuesday
 * takes away a badge someone earned in March, which is precisely the punishing
 * pattern the rest of this feature avoids.
 */
export function longestRun(dates: string[]): number {
  const unique = [...new Set(dates)].sort();
  if (unique.length === 0) return 0;

  let longest = 1;
  let run = 1;

  for (let i = 1; i < unique.length; i += 1) {
    const previous = new Date(`${unique[i - 1]}T00:00:00`);
    const current = new Date(`${unique[i]}T00:00:00`);
    const gapDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000);

    run = gapDays === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return longest;
}
