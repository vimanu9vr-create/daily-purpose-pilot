import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useProfile } from "@/features/onboarding/use-profile";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import { trail } from "@/lib/telemetry";

import { localDateKey } from "@/features/actions/use-actions";
import {
  buildPracticePlan,
  stretchToBudget,
  type PracticeStyle,
  type StepId,
} from "./practice-plan";

export const practiceKeys = {
  today: ["practice", "today"] as const,
  history: ["practice", "history"] as const,
};

/**
 * Today's plan, assembled from the profile.
 *
 * Reads defensively. Someone who onboarded before the three practice questions
 * existed has no answers stored, and the right response to that is a sensible
 * five-minute session rather than an empty one or a crash.
 */
export function usePracticePlan() {
  const { data: profile } = useProfile();

  const minutes = profile?.practice_minutes ?? 5;
  const styles = (profile?.practice_styles ?? []) as PracticeStyle[];

  return stretchToBudget(buildPracticePlan(minutes, styles), minutes);
}

/**
 * Whether today's practice is already done, so Home can say so.
 *
 * Reads a list and takes the first rather than using `.maybeSingle()`. There
 * is no unique constraint on (user, date) — someone can genuinely practise
 * twice — and `.maybeSingle()` throws when it finds two rows. That would have
 * turned "did the practice twice in one day" into a broken home screen, which
 * is precisely the kind of silent-until-it-isn't failure this app keeps
 * producing.
 */
export function useTodaysPractice() {
  const userId = useUserId();
  const today = localDateKey();

  return useQuery({
    queryKey: [...practiceKeys.today, today],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_sessions")
        .select("id,seconds,steps_completed,for_date")
        .eq("for_date", today)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useRecordPractice() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({
      steps,
      seconds,
      desireId,
    }: {
      steps: StepId[];
      seconds: number;
      desireId: string | null;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const today = localDateKey();

      // Update rather than insert if today already has a session. Without this
      // a second run adds a second row, and the weekly report then counts one
      // day as two practices — a number that quietly overstates what someone
      // did, which is the opposite of the point.
      const { data: existing } = await supabase
        .from("practice_sessions")
        .select("id,seconds,steps_completed")
        .eq("for_date", today)
        .limit(1);

      const previous = existing?.[0];

      if (previous) {
        const { error } = await supabase
          .from("practice_sessions")
          .update({
            // Time accumulates across the day; the steps are the union of both.
            seconds: previous.seconds + Math.round(seconds),
            steps_completed: [...new Set([...previous.steps_completed, ...steps])],
            desire_id: desireId,
          })
          .eq("id", previous.id);
        if (error) throw error;
        trail("practice", "repeated", { seconds: Math.round(seconds) });
        return;
      }

      const { error } = await supabase.from("practice_sessions").insert({
        user_id: userId,
        desire_id: desireId,
        steps_completed: steps,
        seconds: Math.round(seconds),
        for_date: today,
      });
      if (error) throw error;
      trail("practice", "completed", { steps: steps.length, seconds: Math.round(seconds) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: practiceKeys.today });
      void queryClient.invalidateQueries({ queryKey: practiceKeys.history });
    },
  });
}

/**
 * Practice sessions over a window — the source for the streak and the weekly
 * report.
 */
export function usePracticeHistory(days = 60) {
  const userId = useUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);

  return useQuery({
    queryKey: [...practiceKeys.history, days],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_sessions")
        .select("id,for_date,seconds,steps_completed")
        .gte("for_date", localDateKey(since))
        .order("for_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Current streak, counted backwards from today.
 *
 * Deliberately forgiving in one specific way: not having practised *yet today*
 * doesn't break the streak, because it's only 9am. Streaks that reset at
 * midnight punish people for a day that hasn't finished, which is the anxious
 * pattern the blueprint explicitly asked to avoid.
 */
export function usePracticeStreak(): number {
  const { data: sessions } = usePracticeHistory();
  if (!sessions || sessions.length === 0) return 0;

  const days = new Set(sessions.map((session) => session.for_date));
  let streak = 0;
  const cursor = new Date();

  if (!days.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  while (days.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
