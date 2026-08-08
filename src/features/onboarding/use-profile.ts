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

      /**
       * Upsert rather than update, and check that a row actually came back.
       *
       * `.update()` on a row that doesn't exist matches nothing and returns no
       * error — a silent no-op. So if the profile row is missing for any
       * reason, onboarding appeared to finish, wrote nothing, and the guard
       * sent the person straight back to question one. Six questions, answered,
       * then asked again, forever, with no error anywhere.
       *
       * The row is normally created by the on_auth_user_created trigger. This
       * makes the app survive its absence instead of trapping someone in a
       * loop, and `.select()` means a zero-row write is now loud.
       */
      const { data: savedProfile, error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            display_name: answers.displayName.trim() || null,
            focus_areas: answers.focusAreas,
            desires: answers.desires.trim() || null,
            obstacles: answers.obstacles.trim() || null,
            desired_feeling: answers.desiredFeeling.trim() || null,
            tone: answers.tone,
            onboarded_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .select("*")
        .maybeSingle();

      if (profileError) throw profileError;
      if (!savedProfile?.onboarded_at) {
        throw new Error("Couldn't save your answers. Please try again.");
      }

      // What they typed becomes a desire (which the home feed writes stories
      // from) and a goal (which the coach and habits work from), so they only
      // ever type it once.
      if (answers.desires.trim()) {
        const { error: desireError } = await supabase.from("desires").insert({
          user_id: userId,
          title: answers.desires.trim(),
          description: answers.desiredFeeling.trim() || null,
          category: answers.focusAreas[0] ?? null,
        });
        if (desireError) throw desireError;

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

      // The saved profile, not the seeded-affirmation count: onSuccess needs it
      // to prime the cache before the page navigates. Nothing reads the count.
      return savedProfile;
    },
    onSuccess: (savedProfile) => {
      /**
       * Write the profile straight into the cache rather than only
       * invalidating it.
       *
       * This is what actually caused onboarding to loop. The page did
       * `await mutateAsync(...)` then navigated immediately, while
       * invalidateQueries is fire-and-forget — so /app read the *cached*
       * profile, which still had onboarded_at null, and its guard sent the
       * person back to question one. The answers had saved correctly every
       * single time; the redirect was racing the refetch.
       *
       * setQueryData closes the race: by the time navigation happens the cache
       * already holds the completed profile.
       */
      if (savedProfile) queryClient.setQueryData(profileKeys.me, savedProfile);

      void queryClient.invalidateQueries({ queryKey: affirmationKeys.saved });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["desires"] });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't finish setting up"),
  });
}
