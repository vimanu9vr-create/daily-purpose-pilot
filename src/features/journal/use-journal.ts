import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { currentStreak, toISODate } from "@/lib/dates";

export type JournalEntry = Database["public"]["Tables"]["journals"]["Row"];

export const JOURNAL_PROMPTS = [
  "What are you grateful for today?",
  "What evidence supports your goal?",
  "What challenge did you overcome?",
  "What action brings you closer to your goal tomorrow?",
  "What inspired you today?",
  "What would the version of you who already has this do next?",
] as const;

export const MOODS = [
  { value: 1, emoji: "😞", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Steady" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

export const journalKeys = { all: ["journals"] as const };

/** Rotates daily but deterministically, so the prompt doesn't change on re-render. */
export function promptForToday(date = new Date()): string {
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return JOURNAL_PROMPTS[dayNumber % JOURNAL_PROMPTS.length]!;
}

export function useJournalEntries() {
  const userId = useUserId();
  return useQuery({
    queryKey: journalKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journals")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useJournalStats() {
  const { data } = useJournalEntries();
  const entries = data ?? [];
  return {
    count: entries.length,
    streak: currentStreak(new Set(entries.map((e) => e.entry_date))),
  };
}

export function useCreateEntry() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      prompt,
      mood,
    }: {
      content: string;
      prompt: string;
      mood: number | null;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("journals").insert({
        user_id: userId,
        content,
        prompt,
        mood,
        entry_date: toISODate(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry saved");
      void queryClient.invalidateQueries({ queryKey: journalKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't save that entry"),
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("journals").update({ content }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry updated");
      void queryClient.invalidateQueries({ queryKey: journalKeys.all });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't update that entry"),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: journalKeys.all }),
    onError: (error: Error) => toast.error(error.message || "Couldn't delete that entry"),
  });
}
