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
 *
 * Amounts are in USD because the audience is global English rather than India.
 * Apple and Google localise the actual subscription price per storefront, but
 * these are copy, not prices, so they have to be picked — and dollars read as
 * neutral to more English speakers than rupees or pounds do.
 */
export const TRENDING_DESIRES = [
  // Money and work
  "$10k months",
  "Financial freedom",
  "My business taking off",
  "Dream job offer",
  "Quitting the job I hate",
  "Being paid what I'm worth",
  "Going viral",
  "My first million",

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
  "A summer in Europe",
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
    onSuccess: (desire) => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.desires });

      /**
       * Write affirmations for it immediately.
       *
       * Typing what you want is the main thing this app asks of a person, and
       * until now it produced stories but no affirmations — the affirmations
       * screen still said "add a goal first", because it read a different
       * table. Making the user go and press a second button to get the thing
       * they came for is a design failure even when it works.
       *
       * Fire-and-forget: if it fails the library affirmations still show, and
       * nobody is told about a background job they didn't start.
       */
      void supabase.functions
        .invoke("ai-affirmations", { body: { desireId: desire.id, category: desire.category } })
        .then(() => queryClient.invalidateQueries({ queryKey: ["affirmations"] }))
        .catch(() => undefined);
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

/**
 * Everything the library and the feed are built from.
 *
 * ## Why this is two queries
 *
 * It used to be one: newest 60 rows, any kind. That was fine at twenty stories
 * and silently wrong at six hundred. Personal stories regenerate every four
 * hours, so they are always the newest rows in the table — and once there were
 * more than sixty of them, they filled the limit completely and pushed the
 * library out of the result entirely.
 *
 * The sleep, meditation, frequency and affirmation tracks were all still in
 * the database. They just hadn't been fetched since the day they were seeded.
 * Reported as "there is no sleep tracks, meditation, frequency" — accurate
 * from the outside, and nothing to do with seeding.
 *
 * Splitting them means a flood of one kind can never hide the other, whatever
 * happens to the volume of either. A shared limit across two things that grow
 * at wildly different rates is a bug waiting for a big enough number.
 */
export function useStories() {
  const userId = useUserId();
  return useQuery({
    queryKey: storyKeys.stories,
    enabled: Boolean(userId),
    queryFn: async () => {
      const [personal, catalogue] = await Promise.all([
        // Today's feed. Expired ones are replaced on the next refresh, and
        // showing them meanwhile means yesterday's stories in today's feed.
        supabase
          .from("moments")
          .select("*")
          .in("source", ["composed", "ai"])
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order("created_at", { ascending: false })
          .limit(60),
        // The library. Small, fixed, and grows by a handful a week, so it is
        // fetched whole rather than competing for a slot.
        supabase
          .from("moments")
          .select("*")
          .eq("source", "catalogue")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (personal.error) throw personal.error;
      if (catalogue.error) throw catalogue.error;

      return [...(personal.data ?? []), ...(catalogue.data ?? [])];
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
    /**
     * Six per desire, not three.
     *
     * With three, one desire filled a single row and the "trending" row below
     * it re-showed the same cards — the same sentence twice on one screen with
     * different photographs, which reads as a bug rather than as variety.
     * There are six templates, so six is the number that uses all of them and
     * guarantees every card on the page says something different.
     */
    mutationFn: async ({ perDesire = 6 }: { perDesire?: number } = {}) => {
      if (!userId) throw new Error("Not signed in");

      /**
       * Read the desires fresh rather than from the hook's cache.
       *
       * This is why tapping a trending suggestion produced a blank screen.
       * `createDesire` then `generate` ran back to back, but `desires` here
       * came from a React Query cache that hadn't refetched yet — so the brand
       * new desire wasn't in the list, no stories were written for it, and
       * selecting its chip showed an empty feed. The story generator was
       * quietly working from a list that was one item out of date.
       */
      const { data: fresh, error: readError } = await supabase
        .from("desires")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (readError) throw readError;

      const active = fresh ?? desires ?? [];
      if (active.length === 0) {
        throw new Error("Add something you want first — your stories are written from it.");
      }

      /**
       * Make sure each dream has its own artwork.
       *
       * Hooked here rather than onto the insert because there are two places a
       * dream can be created — onboarding and the home input — and a cover set
       * that only appears from one of them is the kind of gap that goes
       * unnoticed for weeks. Everything that writes stories comes through here.
       *
       * Safe to call on every refresh: the function checks storage first and
       * returns without spending anything when the images already exist. Not
       * awaited, because covers arriving a minute later is fine and the stock
       * photograph is showing in the meantime.
       */
      for (const desire of active) {
        void supabase.functions
          .invoke("generate-desire-covers", { body: { desireId: desire.id } })
          .catch(() => undefined);
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;

      const rows: Database["public"]["Tables"]["moments"]["Insert"][] = [];

      /**
       * Ask for every story at once instead of one after another.
       *
       * This used to be a nested loop with `await` inside it: one HTTP request
       * per story, each waiting for the last to finish. Three desires at six
       * stories each is eighteen sequential round trips — about sixteen seconds
       * of staring at a spinner, which is what "it's taking too long" was. The
       * work was always parallelisable; it just wasn't parallel.
       *
       * Now every request is started together and awaited as a group, so the
       * total wait is roughly the slowest single call rather than the sum of
       * all of them. `allSettled` rather than `all` because one story failing
       * should not discard the seventeen that succeeded.
       */
      type Pending = {
        desire: (typeof active)[number];
        variant: number;
        seed: Parameters<typeof composeMomentAt>[0];
        request: Promise<Response> | null;
      };

      const pending: Pending[] = [];

      for (const desire of active) {
        const seed = {
          title: desire.title,
          why: desire.description,
          feeling: null,
          category: desire.category,
          obstacles: null,
        };

        for (let variant = 0; variant < perDesire; variant += 1) {
          pending.push({
            desire,
            variant,
            seed,
            request: token
              ? fetch(`${supabaseUrl}/functions/v1/ai-moment`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ desireId: desire.id, variant }),
                }).catch(() => null as unknown as Response)
              : null,
          });
        }
      }

      const responses = await Promise.allSettled(pending.map((item) => item.request));

      {
        for (const [index, item] of pending.entries()) {
          const { desire, variant, seed } = item;
          let composed = composeMomentAt(seed, variant);
          let source = "composed";

          const settled = responses[index];
          const response = settled?.status === "fulfilled" ? settled.value : null;

          if (response?.ok) {
            try {
              const result = (await response.json()) as { title?: string; body?: string };
              if (result.body?.trim()) {
                composed = {
                  key: "ai",
                  title: result.title?.trim() || composed.title,
                  body: result.body.trim(),
                };
                source = "ai";
              }
            } catch {
              // Unparseable — the composed version stands.
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
            // A guess, and labelled as one. Sarah reads at roughly 140 words a
            // minute. There used to be a 120-second floor here, which meant a
            // 110-word story displayed "2 MIN" and played for 51 seconds —
            // the floor was doing nothing except making the number wrong.
            // Replaced by the real duration as soon as anyone plays it.
            duration_seconds: Math.max(30, Math.round((words / 140) * 60)),
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

/**
 * Records how long a story's narration actually is.
 *
 * Until the audio exists, the length on a card is a guess from the word count
 * — and the guess had a floor of two minutes, so every short story claimed
 * "2 MIN" while the player counted down from 51 seconds. Same failure as the
 * sleep tracks: a number written by hand and never checked against the thing
 * it describes.
 *
 * Once the audio element reports its real duration there is no reason to keep
 * guessing, so we write it back. The estimate is now only ever used for a
 * story nobody has played yet, and it stops being wrong the first time anyone
 * presses play.
 */
export function useRecordStoryDuration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ storyId, seconds }: { storyId: string; seconds: number }) => {
      const rounded = Math.round(seconds);
      const { error } = await supabase
        .from("moments")
        .update({ duration_seconds: rounded })
        .eq("id", storyId);
      if (error) throw error;
      return rounded;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: storyKeys.stories });
    },
    // Deliberately silent. This is bookkeeping — if it fails the card keeps
    // the estimate, and telling someone mid-session helps nobody.
    onError: () => {},
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
