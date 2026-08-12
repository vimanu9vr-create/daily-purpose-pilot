import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import { trail } from "@/lib/telemetry";

import { composeMilestones } from "./compose-milestones";

/**
 * Milestones — a desire broken into steps you can finish.
 *
 * The reason this exists is the progress bar. Before it, `goals.progress` was
 * a number a human typed, which means it was fiction: it could be 62% on a
 * goal nobody had touched in a month. A percentage that isn't derived from
 * anything is worse than no percentage, because it looks like information.
 *
 * Progress is now computed from two real things — milestones ticked and
 * actions completed — so it can only move because something happened.
 */

export type Milestone = {
  id: string;
  desire_id: string;
  title: string;
  position: number;
  completed_at: string | null;
};

export const milestoneKeys = {
  all: ["milestones"] as const,
  forDesire: (desireId: string) => ["milestones", desireId] as const,
};

export function useMilestones(desireId: string | null) {
  const userId = useUserId();

  return useQuery({
    queryKey: milestoneKeys.forDesire(desireId ?? "none"),
    enabled: Boolean(userId && desireId),
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await supabase
        .from("milestones")
        .select("id,desire_id,title,position,completed_at")
        .eq("desire_id", desireId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });
}

/** Every milestone the user has, for computing progress across the home feed. */
export function useAllMilestones() {
  const userId = useUserId();

  return useQuery({
    queryKey: milestoneKeys.all,
    enabled: Boolean(userId),
    queryFn: async (): Promise<Milestone[]> => {
      const { data, error } = await supabase
        .from("milestones")
        .select("id,desire_id,title,position,completed_at")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });
}

/**
 * Creates the starting set of milestones for a desire.
 *
 * Local templates first, then the AI improves them in the background — the
 * same shape as actions and stories, so this works offline and on the free
 * tier and nobody watches a spinner.
 */
export function useSeedMilestones() {
  const queryClient = useQueryClient();
  const userId = useUserId();

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
      why: string | null;
    }) => {
      if (!userId) throw new Error("Not signed in");

      // Never seed twice. Someone opening a goal on two devices would
      // otherwise end up with two sets of the same five steps.
      const { data: existing } = await supabase
        .from("milestones")
        .select("id")
        .eq("desire_id", desireId)
        .limit(1);
      if (existing && existing.length > 0) return 0;

      const titles = composeMilestones({ title, category, why });
      const { error } = await supabase.from("milestones").insert(
        titles.map((milestoneTitle, index) => ({
          user_id: userId,
          desire_id: desireId,
          title: milestoneTitle,
          position: index,
        })),
      );
      if (error) throw error;

      trail("milestones", "seeded", { count: titles.length });
      void upgradeWithAi(desireId, { title, category, why });
      return titles.length;
    },
    onSuccess: (count) => {
      if (count > 0) void queryClient.invalidateQueries({ queryKey: milestoneKeys.all });
    },
  });
}

async function upgradeWithAi(
  desireId: string,
  seed: { title: string; category: string | null; why: string | null },
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("suggest-milestones", {
      body: { desireId, ...seed },
    });
    if (error) throw error;
    trail("milestones", "ai-upgraded");
  } catch {
    // Templates stand.
  }
}

export function useToggleMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("milestones")
        .update({ completed_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
      return done;
    },
    onSuccess: (done) => {
      void queryClient.invalidateQueries({ queryKey: milestoneKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["milestones"] });
      if (done) toast.success("One step closer.");
    },
    onError: () => toast.error("Couldn't save that."),
  });
}

export function useAddMilestone() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async ({ desireId, title }: { desireId: string; title: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data: existing } = await supabase
        .from("milestones")
        .select("position")
        .eq("desire_id", desireId)
        .order("position", { ascending: false })
        .limit(1);

      const { error } = await supabase.from("milestones").insert({
        user_id: userId,
        desire_id: desireId,
        title: title.trim(),
        position: (existing?.[0]?.position ?? -1) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["milestones"] }),
    onError: () => toast.error("Couldn't add that step."),
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["milestones"] }),
  });
}
