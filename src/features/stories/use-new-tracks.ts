import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { trail } from "@/lib/telemetry";

import { themesForWeek, type NewTrackTheme } from "./new-track-themes";
import { storyKeys } from "./use-stories";

/**
 * Adds this week's new tracks to the library.
 *
 * Three at a time, generated in parallel, and skipped entirely if a track with
 * that title already exists — so opening the app twice in a week doesn't
 * produce six copies.
 *
 * Why this exists: a fixed catalogue of ten items is a demo. The competitor's
 * library feels endless because content keeps arriving, and that turns out to
 * be most of the difference. Since narration is keyed by title, everyone gets
 * the same weekly tracks and the first person to play one pays for it — a
 * growing library that doesn't get proportionally more expensive.
 */
export function useAddWeeklyTracks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ themes }: { themes?: NewTrackTheme[] } = {}) => {
      const wanted = themes ?? themesForWeek(3);

      // Don't rewrite what's already here.
      const { data: existing } = await supabase.from("moments").select("title");
      const have = new Set((existing ?? []).map((row) => row.title.toLowerCase()));

      const missing = wanted.filter((theme) => !have.has(theme.theme.toLowerCase()));
      if (missing.length === 0) return 0;

      const results = await Promise.allSettled(
        missing.map((theme) =>
          supabase.functions.invoke("generate-track", {
            body: {
              kind: theme.kind,
              theme: theme.theme,
              minutes: theme.minutes,
              category: theme.category,
            },
          }),
        ),
      );

      const written = results.filter(
        (result) => result.status === "fulfilled" && !result.value.error,
      ).length;

      trail("library", "weekly-tracks", { asked: missing.length, written });
      return written;
    },
    onSuccess: (count) => {
      if (count > 0) {
        void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
        toast.success(`${count} new ${count === 1 ? "session" : "sessions"} in your library`);
      }
    },
    onError: () => {
      // Silent. The library already has plenty; a failed top-up is not news.
    },
  });
}
