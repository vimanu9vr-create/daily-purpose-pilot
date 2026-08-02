import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { affirmationKeys } from "@/features/affirmations/use-affirmations";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { personalizedAffirmations, primaryCategory, type OnboardingAnswers } from "./personalize";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const profileKeys = { me: ["profile"] as const };

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKeys.me,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Database["public"]["Tables"]["profiles"]["Update"]) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: profileKeys.me }),
    onError: (error: Error) => toast.error(error.message || "Couldn't save that"),
  });
}

/**
 * Saves the onboarding answers and seeds the user's affirmations from them.
 *
 * Seeds locally first so onboarding always ends with real content, then asks
 * the edge function for better ones in the background. If that isn't deployed,
 * nothing breaks — the user just keeps the locally composed set.
 */
export function useCompleteOnboarding() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (answers: OnboardingAnswers) => {
      if (!userId) throw new Error("Not signed in");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: answers.displayName.trim() || null,
          focus_areas: answers.focusAreas,
          desires: answers.desires.trim() || null,
          obstacles: answers.obstacles.trim() || null,
          desired_feeling: answers.desiredFeeling.trim() || null,
          tone: answers.tone,
          onboarded_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (profileError) throw profileError;

      // The stated desire becomes a real goal, so Moments and the coach have
      // something to work from without asking the user to type it twice.
      if (answers.desires.trim()) {
        const { error: goalError } = await supabase.from("goals").insert({
          user_id: userId,
          title: answers.desires.trim(),
          feeling: answers.desiredFeeling.trim() || null,
          obstacles: answers.obstacles.trim() || null,
          category: answers.focusAreas[0] ?? null,
        });
        if (goalError) throw goalError;
      }

      const seeded = personalizedAffirmations(answers);
      const category = primaryCategory(answers);

      const { error: affirmationError } = await supabase.from("affirmations").insert(
        seeded.map((text) => ({
          user_id: userId,
          text,
          category,
          source: "onboarding",
          is_favorite: false,
        })),
      );
      if (affirmationError) throw affirmationError;

      // Best effort upgrade — never blocks finishing onboarding.
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (token) {
          const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
          await fetch(`${supabaseUrl}/functions/v1/ai-affirmations`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ category }),
          });
        }
      } catch {
        // Not deployed or offline. The seeded set already covers it.
      }

      return seeded.length;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
      void queryClient.invalidateQueries({ queryKey: affirmationKeys.saved });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't finish setting up"),
  });
}
