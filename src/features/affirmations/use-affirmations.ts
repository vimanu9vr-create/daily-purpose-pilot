import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import {
  AFFIRMATION_CATEGORIES,
  affirmationOfTheDay,
  allAffirmations,
} from "./affirmation-library";

export type Affirmation = Database["public"]["Tables"]["affirmations"]["Row"];

export const affirmationKeys = {
  saved: ["affirmations"] as const,
};

/** Affirmations the user has saved or had generated for them. */
export function useSavedAffirmations() {
  const userId = useUserId();
  return useQuery({
    queryKey: affirmationKeys.saved,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affirmations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * The deck the user actually swipes through: their AI-generated and saved
 * affirmations first, then the curated library for the chosen category.
 */
export function useAffirmationDeck(categoryId: string | null) {
  const { data: saved } = useSavedAffirmations();

  const savedForCategory = (saved ?? [])
    .filter((a) => (categoryId ? a.category === categoryId : true))
    .map((a) => ({ id: a.id, text: a.text, category: a.category ?? "growth", saved: true }));

  const library = (
    categoryId
      ? (AFFIRMATION_CATEGORIES.find((c) => c.id === categoryId)?.affirmations ?? []).map(
          (text) => ({ text, category: categoryId }),
        )
      : allAffirmations()
  ).map((item, index) => ({
    id: `lib-${item.category}-${index}`,
    text: item.text,
    category: item.category,
    saved: false,
  }));

  // Personal ones lead; library fills the rest. Dedupe on text so a saved
  // library affirmation doesn't appear twice.
  const seen = new Set(savedForCategory.map((a) => a.text));
  return [...savedForCategory, ...library.filter((a) => !seen.has(a.text))];
}

/** One affirmation for today — the user's own if they have any, else the library. */
export function useDailyAffirmation() {
  const { data: saved } = useSavedAffirmations();

  const personal = (saved ?? []).map((a) => ({ text: a.text, category: a.category ?? "growth" }));
  const pool = personal.length > 0 ? personal : allAffirmations();
  return affirmationOfTheDay(pool);
}

export function useSaveAffirmation() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      text,
      category,
      goalId,
      source = "library",
    }: {
      text: string;
      category: string;
      goalId?: string | null;
      source?: string;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("affirmations").insert({
        user_id: userId,
        text,
        category,
        goal_id: goalId ?? null,
        is_favorite: true,
        source,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved to your affirmations");
      void queryClient.invalidateQueries({ queryKey: affirmationKeys.saved });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't save that one"),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from("affirmations")
        .update({ is_favorite: isFavorite })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: affirmationKeys.saved }),
    onError: (error: Error) => toast.error(error.message || "Couldn't update that"),
  });
}

export function useDeleteAffirmation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("affirmations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: affirmationKeys.saved }),
    onError: (error: Error) => toast.error(error.message || "Couldn't delete that"),
  });
}

/**
 * Ask the edge function for affirmations written from the user's own goals.
 * Fails soft: if the function isn't deployed yet, the curated library still
 * carries the whole feature.
 */
export function useGenerateAffirmations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ categoryId }: { categoryId: string | null }) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-affirmations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ category: categoryId }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(
          detail?.message ??
            "Personalised affirmations aren't switched on yet — the library below still works.",
        );
      }

      return (await response.json()) as { affirmations: string[] };
    },
    onSuccess: (result) => {
      toast.success(`${result.affirmations.length} new affirmations written for you`);
      void queryClient.invalidateQueries({ queryKey: affirmationKeys.saved });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
