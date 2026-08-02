import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useGoals } from "@/features/goals/use-goals";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toISODate } from "@/lib/dates";

import { composeMoment, composeMomentAt, momentTemplateCount } from "./compose-moment";

export type Moment = Database["public"]["Tables"]["moments"]["Row"];

export const momentKeys = {
  all: ["moments"] as const,
  today: ["moments", "today"] as const,
};

export function useMoments() {
  const userId = useUserId();
  return useQuery({
    queryKey: momentKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moments")
        .select("*")
        .order("moment_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTodaysMoment() {
  const userId = useUserId();
  return useQuery({
    queryKey: momentKeys.today,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moments")
        .select("*")
        .eq("moment_date", toISODate())
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

/**
 * Creates today's moment from the user's current focus goal.
 *
 * Tries the AI edge function first and falls back to the on-device composer,
 * so the feature never simply fails — it just gets better when AI is available.
 */
export function useCreateTodaysMoment() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { data: goals } = useGoals();

  return useMutation({
    mutationFn: async ({ variant }: { variant?: number } = {}) => {
      if (!userId) throw new Error("Not signed in");

      const goal = goals?.find((g) => g.status !== "achieved") ?? goals?.[0];
      if (!goal) {
        throw new Error(
          "Add a goal first — your moment is written from what you're working toward.",
        );
      }

      const seed = {
        title: goal.title,
        why: goal.why,
        feeling: goal.feeling,
        category: goal.category,
        obstacles: goal.obstacles,
      };

      let composed = variant === undefined ? composeMoment(seed) : composeMomentAt(seed, variant);
      let source = "composed";

      // Best effort: a real model writes a better scene than a template.
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (token) {
          const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
          const response = await fetch(`${supabaseUrl}/functions/v1/ai-moment`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ goalId: goal.id, variant }),
          });
          if (response.ok) {
            const result = (await response.json()) as { title?: string; body?: string };
            if (result.body?.trim()) {
              composed = {
                key: "ai",
                title: result.title?.trim() || composed.title,
                body: result.body.trim(),
              };
              source = "ai";
            }
          }
        }
      } catch {
        // Offline or not deployed — the composed version is already good to go.
      }

      const { data, error } = await supabase
        .from("moments")
        .insert({
          user_id: userId,
          goal_id: goal.id,
          title: composed.title,
          body: composed.body,
          category: goal.category,
          moment_date: toISODate(),
          source,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: momentKeys.all });
      void queryClient.invalidateQueries({ queryKey: momentKeys.today });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create today's moment"),
  });
}

export function useToggleMomentFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from("moments")
        .update({ is_favorite: isFavorite })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: momentKeys.all });
      void queryClient.invalidateQueries({ queryKey: momentKeys.today });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update that"),
  });
}

export function useMarkListened() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("moments")
        .update({ listened_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: momentKeys.all }),
  });
}

export function useDeleteMoment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("moments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: momentKeys.all });
      void queryClient.invalidateQueries({ queryKey: momentKeys.today });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't delete that"),
  });
}

export { momentTemplateCount };
