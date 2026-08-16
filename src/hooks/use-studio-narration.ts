import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { reportError, trail } from "@/lib/telemetry";

/**
 * Plays real narration audio (ElevenLabs, generated server-side and cached).
 *
 * Exposes the same shape as `useNarration` so the player doesn't care which
 * engine is running. If narration isn't configured, or generation fails, the
 * hook reports `available: false` and the player says so rather than falling
 * back to a worse voice.
 *
 * ## Why this plays two files
 *
 * "Voice starts playing after 40 secs, I need immediately because it gets
 * frustrating." The cause was structural: the whole story went to ElevenLabs
 * in one request, and an eighteen-minute sleep script is thousands of
 * characters. Nothing could play until the final character had been rendered.
 *
 * But nobody needs the last sentence in order to hear the first. So the
 * opening two sentences are requested on their own — a few seconds — and start
 * playing immediately, while the remainder renders underneath. When the
 * opening ends, the rest is already loaded and takes over.
 *
 * The join lands on a sentence boundary, where the narration already has a
 * 1.6-second pause built in, so the handover sits inside a silence that was
 * going to be there anyway.
 */

export type StudioState = {
  available: boolean;
  isGenerating: boolean;
  error: string | null;
};

type Piece = { audioUrl: string; marks: number[] };

export function useStudioNarration(
  storyId: string | undefined,
  body: string,
  cachedUrl: string | null,
  cachedMarks: number[] | null,
  sentences: string[],
) {
  const [opening, setOpening] = useState<Piece | null>(
    cachedUrl ? { audioUrl: cachedUrl, marks: cachedMarks ?? [] } : null,
  );
  const [rest, setRest] = useState<Piece | null>(null);
  // True once the whole story is in one file — the cached path, where there is
  // nothing to hand over to.
  const [single, setSingle] = useState(Boolean(cachedUrl));

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [looping, setLooping] = useState(false);
  /** Which file is sounding right now. */
  const [stage, setStage] = useState<"opening" | "rest">("opening");

  const openingRef = useRef<HTMLAudioElement | null>(null);
  const restRef = useRef<HTMLAudioElement | null>(null);
  const openingSecondsRef = useRef(0);
  const playWhenReadyRef = useRef(false);
  const restRequestedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cachedUrl) return;
    setOpening({ audioUrl: cachedUrl, marks: cachedMarks ?? [] });
    setSingle(true);
  }, [cachedUrl, cachedMarks]);

  const current = stage === "rest" ? restRef : openingRef;

  /** Build an audio element and wire the shared handlers onto it. */
  const attach = useCallback(
    (url: string, which: "opening" | "rest") => {
      const audio = new Audio(url);
      audio.preload = "auto";

      audio.addEventListener("loadedmetadata", () => {
        if (which === "opening") openingSecondsRef.current = audio.duration || 0;
        setDuration(() => {
          const head = openingSecondsRef.current;
          const tail = restRef.current?.duration || 0;
          return head + (Number.isFinite(tail) ? tail : 0);
        });
      });

      audio.addEventListener("timeupdate", () => {
        // One continuous clock across both files, so the progress bar and the
        // sentence highlighting don't jump backwards at the handover.
        const offset = which === "rest" ? openingSecondsRef.current : 0;
        setElapsedSeconds(offset + audio.currentTime);
      });

      audio.addEventListener("ended", () => {
        if (which === "opening" && !single) {
          const tail = restRef.current;
          if (tail) {
            setStage("rest");
            void tail.play().catch(() => setIsPlaying(false));
            return;
          }
          // The remainder hasn't landed yet. Wait for it rather than stopping:
          // stopping here is what a listener would read as the track ending
          // early, which is the bug we spent a day on.
          playWhenReadyRef.current = true;
          setIsPlaying(false);
          return;
        }
        if (looping) {
          audio.currentTime = 0;
          void audio.play();
          return;
        }
        setIsPlaying(false);
      });

      audio.addEventListener("error", () => {
        setError("Couldn't play that narration.");
        setIsPlaying(false);
      });

      return audio;
    },
    [looping, single],
  );

  // The opening (or, on the cached path, the whole story).
  useEffect(() => {
    if (!opening) return;
    const audio = attach(opening.audioUrl, "opening");
    openingRef.current = audio;

    if (playWhenReadyRef.current && stage === "opening") {
      playWhenReadyRef.current = false;
      void audio
        .play()
        .then(() => setIsPlaying(true))
        // iOS refuses if too long has passed since the tap. Leave it ready.
        .catch(() => setIsPlaying(false));
    }

    return () => {
      audio.pause();
      openingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening?.audioUrl, attach]);

  // The remainder, prepared silently while the opening plays.
  useEffect(() => {
    if (!rest) return;
    const audio = attach(rest.audioUrl, "rest");
    restRef.current = audio;

    // The opening finished before this arrived — pick straight up.
    if (playWhenReadyRef.current) {
      playWhenReadyRef.current = false;
      setStage("rest");
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    return () => {
      audio.pause();
      restRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest?.audioUrl, attach]);

  /**
   * Sentence times across both files.
   *
   * The remainder's timings start from zero in its own file, so they're shifted
   * by the opening's real duration. Using the measured duration rather than the
   * last mark matters: the story ends with a trailing pause that no sentence
   * starts in, and ignoring it would make every later sentence land early.
   */
  const marks = useMemo(() => {
    const head = opening?.marks ?? [];
    if (!rest) return head;
    const offset = openingSecondsRef.current;
    return [...head, ...rest.marks.map((mark) => mark + offset)];
  }, [opening?.marks, rest]);

  const currentIndex = useMemo(() => {
    if (marks.length === 0) return 0;
    let index = 0;
    for (let i = 0; i < marks.length; i += 1) {
      if ((marks[i] ?? 0) <= elapsedSeconds) index = i;
      else break;
    }
    return Math.min(index, sentences.length - 1);
  }, [elapsedSeconds, marks, sentences.length]);

  const marksRef = useRef<number[]>(marks);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  /** One call to the narration function. Returns the piece, or null. */
  const request = useCallback(
    async (voice: string, part?: "opening" | "rest"): Promise<Piece | null> => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Session expired.");

      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/narrate-story`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, voice, part }),
      });

      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(detail?.message ?? "Studio narration isn't available.");
      }

      const result = (await response.json()) as {
        audioUrl: string | null;
        marks: number[] | null;
        empty?: boolean;
      };
      if (!result.audioUrl || result.empty) return null;
      return { audioUrl: result.audioUrl, marks: result.marks ?? [] };
    },
    [storyId],
  );

  const generate = useCallback(
    async (voice = "sarah", playWhenReady = false) => {
      if (!storyId || !body.trim()) return false;
      playWhenReadyRef.current = playWhenReady;
      setIsGenerating(true);
      setError(null);
      setStage("opening");
      trail("narration", "generate:start", { voice, playWhenReady });

      try {
        // Only the opening is awaited. This is the entire latency fix: the
        // listener waits for two sentences, not for eighteen minutes of audio.
        const head = await request(voice, "opening");
        if (!head) {
          setError("There's nothing to read here.");
          return false;
        }
        setSingle(false);
        setOpening(head);
        trail("narration", "opening:ready");

        // Deliberately not awaited. The opening is already playing by the time
        // this resolves, which is the whole point.
        if (restRequestedRef.current !== storyId) {
          restRequestedRef.current = storyId;
          void request(voice, "rest")
            .then((tail) => {
              if (tail) setRest(tail);
              else setSingle(true); // Short story: the opening was all of it.
              trail("narration", "rest:ready", { had: Boolean(tail) });
            })
            .catch((err) => {
              // The opening still plays. Report it, don't interrupt them.
              reportError(err, { feature: "narration", phase: "rest" });
            });
        }

        return true;
      } catch (err) {
        setError((err as Error).message);
        playWhenReadyRef.current = false;
        reportError(err, { feature: "narration", phase: "generate" });
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [body, request, storyId],
  );

  /**
   * Fetch just the opening, without the remainder.
   *
   * Called when the player screen opens, so the first lines are usually
   * already in hand by the time the play button is pressed — which turns the
   * remaining few seconds of wait into none at all.
   *
   * Deliberately opening-only. Opening a story is a strong enough signal to
   * spend two sentences on, and cheap: the remainder is the part that costs
   * real money, and it still waits until someone actually presses play.
   */
  const prepareOpening = useCallback(
    async (voice = "sarah") => {
      if (!storyId || !body.trim() || opening) return;
      try {
        const head = await request(voice, "opening");
        if (head) {
          setSingle(false);
          setOpening(head);
          trail("narration", "opening:prefetched");
        }
      } catch {
        // Pressing play will try again and show a message if it fails.
      }
    },
    [body, opening, request, storyId],
  );

  const play = useCallback((fromSentence = 0) => {
    const audio = openingRef.current;
    if (!audio) return;
    const target = marksRef.current?.[fromSentence];
    if (typeof target === "number") audio.currentTime = target;
    void audio.play();
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    openingRef.current?.pause();
    restRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const audio = current.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [current]);

  /** Seek across both files as though they were one. */
  const seekTo = useCallback(
    (seconds: number) => {
      const head = openingSecondsRef.current;
      const tail = restRef.current;

      if (tail && seconds >= head) {
        if (stage !== "rest") {
          openingRef.current?.pause();
          setStage("rest");
        }
        tail.currentTime = Math.max(0, Math.min(tail.duration || 0, seconds - head));
        if (isPlaying) void tail.play();
        return;
      }

      const start = openingRef.current;
      if (!start) return;
      if (stage !== "opening") {
        tail?.pause();
        setStage("opening");
      }
      start.currentTime = Math.max(0, Math.min(start.duration || 0, seconds));
      if (isPlaying) void start.play();
    },
    [isPlaying, stage],
  );

  const skip = useCallback(
    (seconds: number) => seekTo(elapsedSeconds + seconds),
    [elapsedSeconds, seekTo],
  );

  const seekToSentence = useCallback(
    (index: number) => {
      const target = marksRef.current?.[index];
      if (typeof target === "number") seekTo(target);
    },
    [seekTo],
  );

  const seekToRatio = useCallback(
    (ratio: number) => seekTo(Math.max(0, Math.min(1, ratio)) * duration),
    [duration, seekTo],
  );

  const toggleLoop = useCallback(() => setLooping((l) => !l), []);

  return {
    available: Boolean(opening),
    isGenerating,
    error,
    generate,
    prepareOpening,
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
