import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUserId } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { reportError, trail } from "@/lib/telemetry";

import { buildProgramme, programmeTitle, type ProgrammeLength } from "./programme-plan";

export type Programme = Database["public"]["Tables"]["programmes"]["Row"];
export type ProgrammeDayRow = Database["public"]["Tables"]["programme_days"]["Row"];

export const programmeKeys = {
  all: ["programmes"] as const,
  days: (id: string) => ["programmes", id, "days"] as const,
};

export function useProgrammes() {
  const userId = useUserId();
  return useQuery({
    queryKey: programmeKeys.all,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programmes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useProgrammeDays(programmeId: string | undefined) {
  return useQuery({
    queryKey: programmeKeys.days(programmeId ?? "none"),
    enabled: Boolean(programmeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programme_days")
        .select("*")
        .eq("programme_id", programmeId!)
        .order("day_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Starts a programme.
 *
 * All the days are written up front, in one insert, rather than a day at a
 * time. Two reasons. Someone starting a 21-day programme should be able to see
 * what they're committing to — an arc you can't look at is just a promise. And
 * generating day fourteen on day fourteen means day fourteen can fail, which
 * turns a bad network moment into a broken programme.
 *
 * It's cheap: this is local text, no AI call. The audio is what costs money,
 * and that still waits until a day is actually opened.
 */
export function useStartProgramme() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      desireId,
      desireTitle,
      length,
    }: {
      desireId: string;
      desireTitle: string;
      length: ProgrammeLength;
    }) => {
      if (!userId) throw new Error("Not signed in.");

      const { data: programme, error } = await supabase
        .from("programmes")
        .insert({
          user_id: userId,
          desire_id: desireId,
          title: programmeTitle(desireTitle, length),
          length_days: length,
        })
        .select()
        .single();
      if (error) throw error;

      /**
       * The arc is local; the LINES are written for this dream.
       *
       * Reported as: the 7-day and 21-day programmes show the same
       * affirmations for the Defender, the $10k and the app. They did. Three of
       * the seven stages never mentioned the dream at all, so those days were
       * byte-identical for everyone, and the other four pasted the title into a
       * noun-shaped slot: "I want I am earning $10k weekly, and I say so
       * without apologising."
       *
       * The stage themes survive — naming, deserving, identity, work, doubt,
       * being seen, ordinary is a genuinely good arc and it was never the
       * problem. One call writes every day's lines against those themes, so a
       * twenty-one day commitment is twenty-one different days about the thing
       * they actually typed.
       *
       * If the writer can't answer, the programme is not created at all. A
       * half-written programme would show blanks partway through something
       * somebody committed to, which is worse than not starting.
       */
      const skeleton = buildProgramme(desireTitle, length);

      const { data: written, error: writeError } = await supabase.functions.invoke(
        "ai-affirmations",
        { body: { desireId, stages: skeleton.map((day) => day.theme) } },
      );

      const lines = (written as { days?: { lines?: string[] }[] } | null)?.days;
      if (writeError || !lines || lines.length < skeleton.length) {
        await supabase.from("programmes").delete().eq("id", programme.id);
        throw new Error("Couldn't write that programme just now. Try again in a moment.");
      }

      const days = skeleton.map((day, index) => ({
        programme_id: programme.id,
        user_id: userId,
        day_number: day.dayNumber,
        theme: day.theme,
        intention: day.intention,
        lines: lines[index]?.lines?.length ? lines[index]!.lines! : day.lines,
      }));

      const { error: daysError } = await supabase.from("programme_days").insert(days);
      if (daysError) {
        // A programme with no days is worse than no programme — it would sit
        // on Home forever showing nothing. Take it back out.
        await supabase.from("programmes").delete().eq("id", programme.id);
        throw daysError;
      }

      trail("programmes", "started", { length });
      return programme;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: programmeKeys.all });
    },
    onError: (error) => reportError(error, { feature: "programmes", phase: "start" }),
  });
}

/**
 * Marks a day done, and the programme finished if that was the last one.
 *
 * Only ever sets `completed_at`. There is no un-complete and no reset: nothing
 * in this feature can take away a day someone did.
 */
export function useCompleteDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ day, programme }: { day: ProgrammeDayRow; programme: Programme }) => {
      if (day.completed_at) return day;

      const { error } = await supabase
        .from("programme_days")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", day.id);
      if (error) throw error;

      if (day.day_number >= programme.length_days && !programme.completed_at) {
        await supabase
          .from("programmes")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", programme.id);
      }

      trail("programmes", "day:done", { day: day.day_number });
      return day;
    },
    onSuccess: (_result, { programme }) => {
      void queryClient.invalidateQueries({ queryKey: programmeKeys.days(programme.id) });
      void queryClient.invalidateQueries({ queryKey: programmeKeys.all });
    },
    onError: (error) => reportError(error, { feature: "programmes", phase: "complete" }),
  });
}

/**
 * Turns a day into something playable.
 *
 * A day's affirmations become an ordinary `moments` row, which means the
 * existing player, the Sarah narration, the split-generation and the covers
 * all work on it with no new code. Building a second player for programmes
 * would have meant every audio fix from this week needing to be made twice.
 *
 * Created on open rather than up front, so a 21-day programme doesn't commission
 * twenty-one tracks the moment somebody presses start.
 */
export function useProgrammeTrack() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ day, programme }: { day: ProgrammeDayRow; programme: Programme }) => {
      if (day.moment_id) return day.moment_id;
      if (!userId) throw new Error("Not signed in.");

      const body = ["Settle where you are.", day.intention, ...day.lines].join("\n\n");

      const { data: moment, error } = await supabase
        .from("moments")
        .insert({
          user_id: userId,
          desire_id: programme.desire_id,
          title: `Day ${day.day_number} — ${day.theme}`,
          hook: day.lines[0] ?? day.theme,
          body,
          kind: "affirmation",
          source: "composed",
          duration_seconds: 5 * 60,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("programme_days").update({ moment_id: moment.id }).eq("id", day.id);

      return moment.id;
    },
    onSuccess: (_id, { programme }) => {
      void queryClient.invalidateQueries({ queryKey: programmeKeys.days(programme.id) });
    },
    onError: (error) => reportError(error, { feature: "programmes", phase: "track" }),
  });
}
