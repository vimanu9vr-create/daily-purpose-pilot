import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import { trail } from "@/lib/telemetry";

/**
 * Today's actions.
 *
 * Two deliberate choices worth knowing about.
 *
 * The date is computed from the device's own clock rather than the server's,
 * because "today" means the user's today. The morning notification already
 * works this way and it's the reason it fires at 07:00 in Lisbon and 07:00 in
 * Sydney rather than once for everybody.
 *
 * Generation is idempotent through a unique index on (user, desire, date)
 * rather than a check-then-insert. Check-then-insert loses the race when the
 * app is open on a phone and a laptop, and you end up with two actions for one
 * morning — the sort of bug that only appears once there are real users, which
 * is exactly when you can't reproduce it.
 */

export type Action = {
  id: string;
  desire_id: string | null;
  body: string;
  for_date: string;
  completed_at: string | null;
  source: string;
};

export const actionKeys = {
  today: ["actions", "today"] as const,
  history: ["actions", "history"] as const,
};

/** The user's local date as YYYY-MM-DD. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useTodaysActions() {
  const userId = useUserId();
  const today = localDateKey();

  return useQuery({
    queryKey: [...actionKeys.today, today],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Action[]> => {
      const { data, error } = await supabase
        .from("actions")
        .select("id,desire_id,body,for_date,completed_at,source")
        .eq("for_date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Action[];
    },
  });
}

/**
 * Makes sure every active desire has an action for today.
 *
 * Runs the local composer first so something appears immediately, then asks
 * the edge function to write a better one. If the function is unreachable the
 * local action stands and nobody sees a failure — the same shape as stories.
 */
/**
 * Asks the writer for today's actions. Writes nothing if it can't get them.
 *
 * ## No template first any more
 *
 * This used to insert a canned action per dream and then quietly ask the AI to
 * replace it. The replacement got exactly one attempt, and if it failed the
 * canned line stayed all day looking exactly like a real one — which is how
 * eleven templates sat on Home for a full day while I was certain the feature
 * worked, and how "update one section of your CV" ended up on screen.
 *
 * A fallback you cannot distinguish from success hides the outage from the
 * only person who could act on it. So there is no fallback: the edge function
 * writes the actions itself, and a day it can't answer has no action rather
 * than a fake one.
 */
export function useEnsureTodaysActions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      desires: { id: string; title: string; category: string | null; description: string | null }[],
    ) => {
      if (desires.length === 0) return 0;
      const today = localDateKey();

      const { data: existing, error: readError } = await supabase
        .from("actions")
        .select("desire_id")
        .eq("for_date", today);
      if (readError) throw readError;

      const have = new Set((existing ?? []).map((row) => row.desire_id));
      const missing = desires.filter((desire) => !have.has(desire.id));
      if (missing.length === 0) return 0;

      const { data, error } = await supabase.functions.invoke("suggest-action", {
        body: {
          forDate: today,
          desires: missing.map((desire) => ({
            id: desire.id,
            title: desire.title,
            category: desire.category,
            why: desire.description,
          })),
        },
      });
      if (error) throw error;

      const written = (data as { written?: number } | null)?.written ?? 0;
      trail("actions", "written", { count: written, asked: missing.length });
      return written;
    },
    onSuccess: (count) => {
      if (count > 0) void queryClient.invalidateQueries({ queryKey: actionKeys.today });
    },
    onError: (error: Error) => trail("actions", "write-failed", { message: error.message }),
  });
}
export function useToggleAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("actions")
        .update({ completed_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
      return done;
    },
    onSuccess: (done) => {
      void queryClient.invalidateQueries({ queryKey: actionKeys.today });
      void queryClient.invalidateQueries({ queryKey: actionKeys.history });
      if (done) toast.success("Done. That's the part that counts.");
    },
    onError: () => toast.error("Couldn't save that just yet."),
  });
}

/**
 * Asks for a different action for today.
 *
 * Used to rotate through a local list of canned lines, which is why pressing
 * it produced the same handful of suggestions forever. It now asks the writer
 * again, so a different action is a genuinely different one.
 */
export function useShuffleAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      desireId,
      title,
      category,
      why,
    }: {
      desireId: string;
      title: string;
      category: string | null;
      why?: string | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("suggest-action", {
        body: {
          forDate: localDateKey(),
          replace: true,
          desires: [{ id: desireId, title, category, why: why ?? null }],
        },
      });
      if (error) throw error;
      if (((data as { written?: number } | null)?.written ?? 0) === 0) {
        throw new Error("Couldn't think of a different one just now.");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: actionKeys.today }),
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Actions completed over a window, for progress and the weekly report.
 *
 * Progress is derived from this rather than stored, so a percentage can only
 * go up because someone did something.
 */
export function useActionHistory(days = 30) {
  const userId = useUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);

  return useQuery({
    queryKey: [...actionKeys.history, days],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Action[]> => {
      const { data, error } = await supabase
        .from("actions")
        .select("id,desire_id,body,for_date,completed_at,source")
        .gte("for_date", localDateKey(since))
        .order("for_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Action[];
    },
  });
}
