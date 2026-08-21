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

/**
 * Capitalise the first letter, and nothing else.
 *
 * Seven of a hundred and eighteen affirmations arrived lowercase — "i reply to
 * tech journalists…", "i publish the update…" — sitting directly under
 * correctly-capitalised ones. Small, and it makes the whole screen look
 * unfinished in a way that is hard to point at.
 *
 * Applied on READ rather than fixed in the database, because that covers the
 * rows that already exist as well as the ones written from now on. A prompt
 * rule alone would only fix the future and leave the seven on screen.
 *
 * Deliberately not a full sentence-caser: these contain proper nouns and
 * amounts the user chose, and anything cleverer would start "fixing" $10k.
 */
function capitalise(text: string): string {
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

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
      return (data ?? []).map((row) => ({ ...row, text: capitalise(row.text) }));
    },
  });
}

/**
 * The one line for a dream — the anchor.
 *
 * Six good affirmations is a list, and a list is something you scroll past.
 * One line that is clearly THE line is something you can carry around all day,
 * which is what somebody means when they ask for a powerful affirmation for a
 * particular desire.
 *
 * The other five still exist and still matter — they are what stops the set
 * going stale when you read it every morning for a month. They just are not
 * the thing on the screen.
 */
export function useAnchorAffirmation(desireId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...affirmationKeys.saved, "anchor", desireId ?? "none"],
    enabled: Boolean(userId) && Boolean(desireId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affirmations")
        .select("*")
        .eq("desire_id", desireId!)
        .eq("is_anchor", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Every affirmation written for one dream. Used to spot a dream that has none. */
export function useAffirmationsByDesire(desireId: string | null | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: [...affirmationKeys.saved, "by-desire", desireId ?? "none"],
    enabled: Boolean(userId) && Boolean(desireId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affirmations")
        .select("id")
        .eq("desire_id", desireId!);
      if (error) throw error;
      return data ?? [];
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

      /**
       * Saving the same line twice does nothing.
       *
       * "I am allowed to take up space." is in the database twice, which means
       * it appears twice in a deck somebody swipes through — the heart is easy
       * to tap again on a card you don't remember having saved, and nothing
       * stopped it. Checking first is cheaper than a unique index here, since
       * a constraint violation would surface as an error toast on what is
       * really a no-op.
       */
      const { data: existing } = await supabase
        .from("affirmations")
        .select("id")
        .eq("text", text)
        .limit(1);
      if (existing && existing.length > 0) return { alreadySaved: true };

      const { error } = await supabase.from("affirmations").insert({
        user_id: userId,
        text,
        category,
        goal_id: goalId ?? null,
        is_favorite: true,
        source,
      });
      if (error) throw error;
      return { alreadySaved: false };
    },
    onSuccess: (result) => {
      toast.success(
        result?.alreadySaved ? "Already in your affirmations" : "Saved to your affirmations",
      );
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
    mutationFn: async ({
      categoryId = null,
      desireId,
    }: {
      categoryId?: string | null;
      /**
       * Write them for ONE dream, and mark one of the six as its anchor.
       *
       * The edge function has always accepted this — `useCreateDesire` passes
       * it — but this hook didn't, so every other caller asked for affirmations
       * by CATEGORY and got six unattached lines. That is why "I want to buy
       * defender car" had seven stories and no affirmations: nothing except the
       * moment of creation could ever write them for a specific dream.
       */
      desireId?: string | null;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Your session expired. Sign in again.");

      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-affirmations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ category: categoryId, ...(desireId ? { desireId } : {}) }),
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
