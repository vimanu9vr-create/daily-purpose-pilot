import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";

import { coverImage } from "./imagery";
import { TRACKS } from "./track-catalogue";
import { storyKeys } from "./use-stories";

/**
 * Seeds the sleep / meditation / frequency catalogue into `moments` for a user.
 *
 * They live in the same table as stories so the player, favourites, narration
 * caching and the library all treat them identically. Keyed on title so a
 * repeat seed is a no-op rather than a duplicate.
 */
export function useSeedTracks() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) return 0;

      const { data: existing, error: readError } = await supabase
        .from("moments")
        .select("title")
        .in("kind", ["sleep", "meditation", "frequency"]);
      if (readError) throw readError;

      const have = new Set((existing ?? []).map((row) => row.title));
      const missing = TRACKS.filter((track) => !have.has(track.title));
      if (missing.length === 0) return 0;

      const { error } = await supabase.from("moments").insert(
        missing.map((track) => ({
          user_id: userId,
          title: track.title,
          hook: track.hook,
          body: track.body,
          kind: track.kind,
          category: track.theme,
          image_url: coverImage(track.slug, track.theme),
          duration_seconds: track.minutes * 60,
          source: "catalogue",
        })),
      );
      if (error) throw error;
      return missing.length;
    },
    onSuccess: (count) => {
      if (count > 0) void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
    },
  });
}

/** True once the catalogue exists, so the Library knows not to seed again. */
export function useHasTracks() {
  const userId = useUserId();
  return useQuery({
    queryKey: ["has-tracks"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moments")
        .select("id")
        .in("kind", ["sleep", "meditation", "frequency"])
        .limit(1);
      if (error) throw error;
      return data.length > 0;
    },
  });
}
