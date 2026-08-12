import { useQuery } from "@tanstack/react-query";

import { localDateKey } from "@/features/actions/use-actions";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";

import { startOfWeek, summariseWeek, type WeeklySummary } from "./weekly-summary";

/**
 * Everything that happened this week, in one query set.
 *
 * Deliberately computed on the device from rows we already have rather than
 * stored as a weekly rollup. A rollup would need a cron job, would be wrong
 * whenever someone completed something late, and would put the report in a
 * different timezone from the person reading it — the same class of mistake as
 * the notification job before it learned about local time.
 */
export function useWeeklySummary(weeksAgo = 0) {
  const userId = useUserId();

  const start = startOfWeek();
  start.setDate(start.getDate() - weeksAgo * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const from = localDateKey(start);
  const to = localDateKey(end);

  return useQuery({
    queryKey: ["weekly", from],
    enabled: Boolean(userId),
    queryFn: async (): Promise<WeeklySummary & { from: string }> => {
      const [practices, actions, journals, milestones, desires] = await Promise.all([
        supabase
          .from("practice_sessions")
          .select("for_date,seconds")
          .gte("for_date", from)
          .lt("for_date", to),
        supabase
          .from("actions")
          .select("desire_id,completed_at")
          .gte("for_date", from)
          .lt("for_date", to),
        supabase.from("journals").select("id").gte("entry_date", from).lt("entry_date", to),
        supabase
          .from("milestones")
          .select("id,completed_at")
          .gte("completed_at", start.toISOString())
          .lt("completed_at", end.toISOString()),
        supabase.from("desires").select("id,title"),
      ]);

      const practiceRows = practices.data ?? [];
      const actionRows = actions.data ?? [];
      const titles = new Map((desires.data ?? []).map((d) => [d.id, d.title]));

      // Which desire got the most completed actions — the honest answer to
      // "what did I actually work on", rather than what someone intended to.
      const tally = new Map<string, number>();
      for (const action of actionRows) {
        if (!action.completed_at || !action.desire_id) continue;
        tally.set(action.desire_id, (tally.get(action.desire_id) ?? 0) + 1);
      }
      const focusAreas = [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => titles.get(id))
        .filter((title): title is string => Boolean(title));

      const summary = summariseWeek({
        practiceDays: [...new Set(practiceRows.map((row) => row.for_date))],
        practiceSeconds: practiceRows.reduce((sum, row) => sum + row.seconds, 0),
        journalEntries: journals.data?.length ?? 0,
        actionsCompleted: actionRows.filter((row) => row.completed_at).length,
        actionsOffered: actionRows.length,
        milestonesCompleted: milestones.data?.length ?? 0,
        focusAreas,
      });

      return { ...summary, from };
    },
  });
}

/** True on Sunday, when the review is offered. */
export function isReviewDay(date = new Date()): boolean {
  return date.getDay() === 0;
}
