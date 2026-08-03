import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Plays real narration audio (ElevenLabs, generated server-side and cached).
 *
 * Exposes the same shape as `useNarration` so the player doesn't care which
 * engine is running. If narration isn't configured, or generation fails, the
 * hook reports `available: false` and the player falls back to browser speech.
 */

export type StudioState = {
  available: boolean;
  isGenerating: boolean;
  error: string | null;
};

export function useStudioNarration(
  storyId: string | undefined,
  body: string,
  cachedUrl: string | null,
  cachedMarks: number[] | null,
  sentences: string[],
) {
  const [audioUrl, setAudioUrl] = useState<string | null>(cachedUrl);
  const [marks, setMarks] = useState<number[] | null>(cachedMarks);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [looping, setLooping] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setAudioUrl(cachedUrl);
    setMarks(cachedMarks);
  }, [cachedUrl, cachedMarks]);

  // One audio element per story.
  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audioRef.current = audio;

    const onTime = () => setElapsedSeconds(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (looping) {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      setIsPlaying(false);
    };
    const onError = () => {
      setError("Couldn't play that narration.");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [audioUrl, looping]);

  /** Which sentence the audio is currently inside. */
  const currentIndex = useMemo(() => {
    if (!marks || marks.length === 0) return 0;
    let index = 0;
    for (let i = 0; i < marks.length; i += 1) {
      if ((marks[i] ?? 0) <= elapsedSeconds) index = i;
      else break;
    }
    return Math.min(index, sentences.length - 1);
  }, [elapsedSeconds, marks, sentences.length]);

  const generate = useCallback(
    async (voice = "sarah") => {
      if (!storyId || !body.trim()) return false;
      setIsGenerating(true);
      setError(null);

      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Session expired.");

        const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
        const response = await fetch(`${supabaseUrl}/functions/v1/narrate-story`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ storyId, voice }),
        });

        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { message?: string } | null;
          setError(detail?.message ?? "Studio narration isn't available.");
          return false;
        }

        const result = (await response.json()) as { audioUrl: string; marks: number[] };
        setAudioUrl(result.audioUrl);
        setMarks(result.marks);
        return true;
      } catch (err) {
        setError((err as Error).message);
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [body, storyId],
  );

  const play = useCallback((fromSentence = 0) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = marksRef.current?.[fromSentence];
    if (typeof target === "number") audio.currentTime = target;
    void audio.play();
    setIsPlaying(true);
  }, []);

  // Keep a ref so `play` doesn't need marks in its dependency list.
  const marksRef = useRef<number[] | null>(marks);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  }, []);

  const seekToSentence = useCallback((index: number) => {
    const audio = audioRef.current;
    const target = marksRef.current?.[index];
    if (!audio || typeof target !== "number") return;
    audio.currentTime = target;
  }, []);

  const seekToRatio = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
  }, []);

  const toggleLoop = useCallback(() => setLooping((l) => !l), []);

  return {
    available: Boolean(audioUrl),
    isGenerating,
    error,
    generate,
    // Playback surface, mirroring useNarration.
    isPlaying,
    currentIndex,
    currentSentence: sentences[currentIndex] ?? "",
    elapsedSeconds,
    totalSeconds: duration,
    looping,
    play,
    stop,
    toggle,
    skip,
    seekToSentence,
    seekToRatio,
    toggleLoop,
  };
}
