import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AFFIRMATION_CATEGORIES } from "@/features/affirmations/affirmation-library";
import { coverImage, themeFor } from "@/features/stories/imagery";
import { storyKeys } from "@/features/stories/use-stories";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { trail } from "@/lib/telemetry";

import { buildTrackScript, TRACK_THEMES } from "./affirmation-tracks";

/**
 * Builds a personal library of affirmation tracks.
 *
 * Twelve tracks, three to fifteen minutes each, built from the user's own AI
 * affirmations where they exist and the curated library where they don't. That
 * turns a library of ten items into twenty-two, and turns affirmations from
 * something you read into something you play.
 *
 * Written locally rather than generated per track. The lines are already
 * personal — either the AI wrote them from this person's desires, or they came
 * from the curated set — so an extra AI call per track would cost money and
 * time to rearrange sentences we already have.
 */
export function useHasAffirmationTracks() {
  const userId = useUserId();

  return useQuery({
    queryKey: ["affirmation-tracks", "exists"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("moments")
        .select("id", { count: "exact", head: true })
        .eq("kind", "affirmation");
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

export function useSeedAffirmationTracks() {
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");

      // Their own affirmations first. These are what the AI wrote from their
      // desires, so a track built from them is genuinely theirs.
      const { data: saved } = await supabase
        .from("affirmations")
        .select("text,category")
        .order("created_at", { ascending: false })
        .limit(120);

      const mine = new Map<string, string[]>();
      for (const row of saved ?? []) {
        const key = row.category ?? "growth";
        mine.set(key, [...(mine.get(key) ?? []), row.text]);
      }

      const rows: Database["public"]["Tables"]["moments"]["Insert"][] = [];

      for (const theme of TRACK_THEMES) {
        const curated =
          AFFIRMATION_CATEGORIES.find((c) => c.id === theme.category)?.affirmations ?? [];
        const personal = mine.get(theme.category) ?? [];

        // Personal lines lead, curated fills to twelve. Twelve is about a
        // hundred seconds of speech, which is the right size for a set that
        // repeats — short enough to become familiar, long enough not to grate.
        const lines = [...new Set([...personal, ...curated])].slice(0, 12);
        if (lines.length < 5) continue;

        const body = buildTrackScript({
          theme: theme.title,
          lines,
          minutes: theme.minutes,
          category: theme.category,
        });

        rows.push({
          user_id: userId,
          title: theme.title,
          hook: lines[0] ?? theme.title,
          body,
          category: theme.category,
          image_url: coverImage(`affirmation-${theme.id}`, themeFor(theme.category)),
          duration_seconds: theme.minutes * 60,
          kind: "affirmation",
          // "catalogue" so narration is shared across users by title — one
          // person's generation pays for everyone's.
          source: "catalogue",
        });
      }

      if (rows.length === 0) return 0;

      const { error } = await supabase.from("moments").insert(rows);
      if (error) throw error;

      trail("affirmation-tracks", "seeded", { count: rows.length });
      return rows.length;
    },
    onSuccess: (count) => {
      if (count > 0) void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
    },
    onError: () => {
      // The library still has everything else. Nothing to interrupt anyone with.
    },
  });
}
