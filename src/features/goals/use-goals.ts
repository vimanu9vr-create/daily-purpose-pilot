import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type GoalStep = Database["public"]["Tables"]["goal_steps"]["Row"];

export const GOAL_CATEGORIES = [
  "Career",
  "Business",
  "Health",
  "Wealth",
  "Relationships",
  "Learning",
  "Creativity",
  "Wellbeing",
] as const;

export const goalKeys = {
  all: ["goals"] as const,
  detail: (id: string) => ["goals", id] as const,
  steps: (goalId: string) => ["goal-steps", goalId] as const,
};

export function useGoals() {
  const userId = useUserId();
  return useQuery({
    queryKey: goalKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*, goal_steps(id, title, completed, order_index)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Goal & {
        goal_steps: Pick<GoalStep, "id" | "title" | "completed" | "order_index">[];
      })[];
    },
  });
}

export function useGoal(goalId: string) {
  return useQuery({
    queryKey: goalKeys.detail(goalId),
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").eq("id", goalId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useGoalSteps(goalId: string) {
  return useQuery({
    queryKey: goalKeys.steps(goalId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_steps")
        .select("*")
        .eq("goal_id", goalId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export type NewGoal = {
  title: string;
  why: string;
  feeling: string;
  category: string;
  target_date: string | null;
  obstacles: string;
};

export function useCreateGoal() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewGoal) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't save that goal"),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goal deleted");
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't delete that goal"),
  });
}

/** Recompute goal.progress from its steps and persist it. */
async function syncGoalProgress(goalId: string) {
  const { data, error } = await supabase
    .from("goal_steps")
    .select("completed")
    .eq("goal_id", goalId);
  if (error) throw error;

  const total = data.length;
  const done = data.filter((s) => s.completed).length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  const { error: updateError } = await supabase
    .from("goals")
    .update({ progress, status: progress === 100 ? "achieved" : "active" })
    .eq("id", goalId);
  if (updateError) throw updateError;
}

export function useAddStep(goalId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, orderIndex }: { title: string; orderIndex: number }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("goal_steps")
        .insert({ goal_id: goalId, user_id: userId, title, order_index: orderIndex });
      if (error) throw error;
      await syncGoalProgress(goalId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.steps(goalId) });
      void queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't add that step"),
  });
}

export function useToggleStep(goalId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, completed }: { stepId: string; completed: boolean }) => {
      const { error } = await supabase
        .from("goal_steps")
        .update({ completed })
        .eq("id", stepId);
      if (error) throw error;
      await syncGoalProgress(goalId);
    },
    // Optimistic: the checkbox should feel instant.
    onMutate: async ({ stepId, completed }) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.steps(goalId) });
      const previous = queryClient.getQueryData<GoalStep[]>(goalKeys.steps(goalId));
      queryClient.setQueryData<GoalStep[]>(goalKeys.steps(goalId), (old) =>
        old?.map((s) => (s.id === stepId ? { ...s, completed } : s)),
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(goalKeys.steps(goalId), context.previous);
      toast.error(error.message || "Couldn't update that step");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.steps(goalId) });
      void queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useDeleteStep(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from("goal_steps").delete().eq("id", stepId);
      if (error) throw error;
      await syncGoalProgress(goalId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.steps(goalId) });
      void queryClient.invalidateQueries({ queryKey: goalKeys.detail(goalId) });
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't delete that step"),
  });
}

export function useReorderSteps(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: GoalStep[]) => {
      await Promise.all(
        ordered.map((step, index) =>
          supabase.from("goal_steps").update({ order_index: index }).eq("id", step.id),
        ),
      );
    },
    onMutate: async (ordered) => {
      await queryClient.cancelQueries({ queryKey: goalKeys.steps(goalId) });
      const previous = queryClient.getQueryData<GoalStep[]>(goalKeys.steps(goalId));
      queryClient.setQueryData<GoalStep[]>(
        goalKeys.steps(goalId),
        ordered.map((s, i) => ({ ...s, order_index: i })),
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(goalKeys.steps(goalId), context.previous);
      toast.error(error.message || "Couldn't reorder steps");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.steps(goalId) });
    },
  });
}
