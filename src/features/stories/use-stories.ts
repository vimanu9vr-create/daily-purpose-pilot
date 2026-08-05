import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { composeMomentAt } from "@/features/moments/compose-moment";
import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import { coverImage, themeFor } from "./imagery";

export type Desire = Database["public"]["Tables"]["desires"]["Row"];
export type Story = Database["public"]["Tables"]["moments"]["Row"];

export const storyKeys = {
  desires: ["desires"] as const,
  stories: ["stories"] as const,
  story: (id: string) => ["stories", id] as const,
};

/** Stories all regenerate on a 4-hour cycle, like Stella's refresh countdown. */
export const REFRESH_HOURS = 4;

export function nextRefreshAt(from = new Date()): Date {
  const next = new Date(from);
  const block = Math.floor(from.getHours() / REFRESH_HOURS) + 1;
  next.setHours(block * REFRESH_HOURS, 0, 0, 0);
  return next;
}

/**
 * The trending strip. These are the front door — most people tap one rather
 * than type, so they have to be specific and a bit bold. Vague suggestions
 * ("be happier") produce vague stories.
 *
 * Deliberately worded as things you're working toward rather than things that
 * arrive on their own, which is the line the whole app holds.
 */
export const TRENDING_DESIRES = [
  // Money and work
  "₹10 lakh months",
  "Financial freedom",
  "My business taking off",
  "Dream job offer",
  "Quitting the job I hate",
  "Being paid what I'm worth",
  "Going viral",
  "First ₹1 crore",

  // Love and self
  "Being deeply loved",
  "Unshakeable confidence",
  "Walking into any room",
  "Loving my own company",
  "Being chosen clearly",
  "Getting over him",
  "Attracting my person",

  // Body, mind, life
  "A calmer mind",
  "Sleeping through the night",
  "The strongest I've been",
  "Euro summer",
  "My own apartment",
  "Moving abroad",
  "Being the person my family relies on",
  "Finishing what I start",
] as const;

export function useDesires() {
  const userId = useUserId();
  return useQuery({
    queryKey: storyKeys.desires,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("desires")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDesire() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("desires")
        .insert({
          user_id: userId,
          title: title.trim(),
          description: description?.trim() || null,
          category: themeFor(title),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.desires });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't save that desire"),
  });
}

export function useUpdateDesire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      title,
      description,
    }: {
      id: string;
      title: string;
      description: string;
    }) => {
      const { error } = await supabase
        .from("desires")
        .update({ title: title.trim(), description: description.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desire updated");
      void queryClient.invalidateQueries({ queryKey: storyKeys.desires });
      void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update that"),
  });
}

export function useDeleteDesire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("desires").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.desires });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't remove that"),
  });
}

export function useStories() {
  const userId = useUserId();
  return useQuery({
    queryKey: storyKeys.stories,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });
}

export function useStory(id: string) {
  return useQuery({
    queryKey: storyKeys.story(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("moments").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * The opening line shown on the card — pulled from the story body so the card
 * and the player agree, rather than being written twice.
 */
function hookFrom(body: string, fallback: string): string {
  const firstSentence = body
    .split(/\n\n/)[0]
    ?.split(/(?<=[.!?])\s/)[0]
    ?.trim();
  if (firstSentence && firstSentence.length > 20 && firstSentence.length < 120) {
    return firstSentence;
  }
  return fallback;
}

/**
 * Generates a batch of stories for the user's desires.
 *
 * On-device composition first so the feed is never empty, then the AI function
 * upgrades each one if it's deployed. Batching means one refresh fills the
 * whole feed rather than the user tapping generate per card.
 */
export function useGenerateStories() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { data: desires } = useDesires();

  return useMutation({
    mutationFn: async ({ perDesire = 3 }: { perDesire?: number } = {}) => {
      if (!userId) throw new Error("Not signed in");
      const active = desires ?? [];
      if (active.length === 0) {
        throw new Error("Add something you want first — your stories are written from it.");
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;

      const rows: Database["public"]["Tables"]["moments"]["Insert"][] = [];

      for (const desire of active) {
        const seed = {
          title: desire.title,
          why: desire.description,
          feeling: null,
          category: desire.category,
          obstacles: null,
        };

        for (let variant = 0; variant < perDesire; variant += 1) {
          let composed = composeMomentAt(seed, variant);
          let source = "composed";

          if (token) {
            try {
              const response = await fetch(`${supabaseUrl}/functions/v1/ai-moment`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ desireId: desire.id, variant }),
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
            } catch {
              // Not deployed or offline — the composed version stands.
            }
          }

          const words = composed.body.split(/\s+/).length;
          rows.push({
            user_id: userId,
            desire_id: desire.id,
            title: composed.title,
            hook: hookFrom(composed.body, composed.title),
            body: composed.body,
            category: desire.category,
            image_url: coverImage(`${desire.id}-${variant}`, themeFor(desire.title)),
            // ~150 words a minute at the slow narration rate we use.
            duration_seconds: Math.max(120, Math.round((words / 150) * 60)),
            kind: "story",
            source,
            expires_at: nextRefreshAt().toISOString(),
          });
        }
      }

      const { error } = await supabase.from("moments").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} new stories ready`);
      void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't create stories"),
  });
}

export function useToggleStoryFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from("moments")
        .update({ is_favorite: isFavorite })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: storyKeys.stories });
      const previous = queryClient.getQueryData<Story[]>(storyKeys.stories);
      queryClient.setQueryData<Story[]>(storyKeys.stories, (old) =>
        old?.map((s) => (s.id === id ? { ...s, is_favorite: isFavorite } : s)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(storyKeys.stories, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
    },
  });
}
