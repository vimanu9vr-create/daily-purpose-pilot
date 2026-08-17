import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { trail } from "@/lib/telemetry";

import { storyKeys } from "./use-stories";

/**
 * Generates AI covers for library tracks that don't have one yet.
 *
 * Deliberately only library tracks. They're shared by title across every user,
 * so one generation serves everybody — the same economics as the narration
 * audio. Personal stories keep the curated photographs, because at 42 stories
 * per person refreshing every four hours a generated image per story would
 * cost more per day than the subscription costs per month.
 *
 * Runs a few at a time and stops. There's no rush: a cover that arrives on the
 * second visit is fine, and a burst of image requests is the fastest way to be
 * rate limited.
 */
/**
 * Off, for now.
 *
 * This drew four AI covers per Library visit for the shared tracks. Sound
 * economics in the long run — one generation serves every user — and the wrong
 * call while a single OpenAI balance also has to pay for the story writer, the
 * affirmations, the daily action and the milestones. When it ran out, all four
 * of those silently fell back to templates and the app looked broken in ways
 * that had nothing to do with pictures.
 *
 * Set this above zero once there's headroom. The stock photographs are fine.
 */
const BATCH = 0;

export function useGenerateCovers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Only tracks still on a stock photo. Generated ones live in our own
      // storage bucket, so the URL tells us which is which.
      const { data: tracks, error } = await supabase
        .from("moments")
        .select("id,image_url,source")
        .eq("source", "catalogue")
        .limit(60);
      if (error) throw error;

      const needing = (tracks ?? [])
        .filter((row) => !row.image_url || row.image_url.includes("unsplash.com"))
        .slice(0, BATCH);

      if (BATCH === 0 || needing.length === 0) return 0;

      const results = await Promise.allSettled(
        needing.map((row) =>
          supabase.functions.invoke("generate-cover", { body: { storyId: row.id } }),
        ),
      );

      const made = results.filter(
        (result) => result.status === "fulfilled" && !result.value.error,
      ).length;

      trail("covers", "generated", { asked: needing.length, made });
      return made;
    },
    onSuccess: (count) => {
      if (count > 0) void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
    },
    onError: () => {
      // Stock photography is a perfectly good fallback. Nothing to say.
    },
  });
}
