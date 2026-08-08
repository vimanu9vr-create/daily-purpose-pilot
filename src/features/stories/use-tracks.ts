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
        .select("id,title,body")
        .in("kind", ["sleep", "meditation", "frequency"]);
      if (readError) throw readError;

      const rows = existing ?? [];
      const have = new Map(rows.map((row) => [row.title, row]));
      const missing = TRACKS.filter((track) => !have.has(track.title));

      if (missing.length > 0) {
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
      }

      /**
       * Refresh scripts that have been rewritten since this user was seeded.
       *
       * Seeding used to insert missing titles and stop there, so anyone who
       * already had the catalogue kept whatever script they were first given —
       * forever. When all ten were rewritten from ~40 seconds of speech to
       * several minutes, not one existing user saw a word of it. The work
       * shipped to the repo and never reached a single person.
       *
       * Clearing audio_url matters as much as the body: the cached narration
       * is of the old script, so without this people would read new words
       * while hearing the old ones.
       */
      const stale = TRACKS.filter((track) => {
        const row = have.get(track.title);
        return row && row.body !== track.body;
      });

      for (const track of stale) {
        const row = have.get(track.title)!;
        const { error } = await supabase
          .from("moments")
          .update({
            body: track.body,
            hook: track.hook,
            duration_seconds: track.minutes * 60,
            audio_url: null,
            audio_voice: null,
            audio_marks: null,
          })
          .eq("id", row.id);
        if (error) throw error;
      }

      return missing.length + stale.length;
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
