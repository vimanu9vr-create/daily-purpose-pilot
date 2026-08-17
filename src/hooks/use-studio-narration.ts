import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { SILENT_WAV } from "@/lib/ambient-audio";
import { reportError, trail } from "@/lib/telemetry";

/**
 * Plays real narration audio (ElevenLabs, generated server-side and cached).
 *
 * ## One file. This used to be two, and that was a mistake.
 *
 * To make playback start quickly I split every track: generate the opening two
 * sentences on their own, start playing those, fetch the remainder underneath.
 * It fixed the forty-second wait and caused two worse problems.
 *
 * The halves didn't match. Two separate requests are two separate
 * performances — eighty characters with no context comes out flat and clipped,
 * thousands of characters comes out flowing and quicker. Reported as "the voice
 * first feels robotic and after some seconds it goes fast." I patched that by
 * passing each half the text either side of it, which helped.
 *
 * Then: "voice gets lag and it gets stuck in between, it doesn't play
 * continuously." That one has no patch. If the remainder isn't rendered by the
 * time the opening runs out — fifteen seconds — the track stops dead until it
 * arrives. A gap in the middle of something you're listening to with your eyes
 * shut is worse than a wait before it starts, because the wait is honest and
 * the gap feels like a fault.
 *
 * So: one request, one file, one performance. It cannot desynchronise and it
 * cannot stall, because there is nothing to hand over to.
 *
 * Latency is handled the honest way instead — by starting the work earlier
 * rather than by starting the playback earlier. Opening a track begins
 * generating it, so by the time the play button is pressed it's usually ready.
 * That costs real money for tracks that are opened and never played, and it's
 * worth it: audio is cached forever, and library tracks are shared by title, so
 * the first person to open one pays and nobody else ever does.
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
  const [marks, setMarks] = useState<number[]>(cachedMarks ?? []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  /** True while the browser has run out of downloaded audio mid-track. */
  const [isBuffering, setIsBuffering] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [looping, setLooping] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playWhenReadyRef = useRef(false);
  const loopingRef = useRef(looping);
  /** In flight, so a prefetch and a tap don't both pay for the same audio. */
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    loopingRef.current = looping;
  }, [looping]);

  useEffect(() => {
    if (!cachedUrl) return;
    setAudioUrl(cachedUrl);
    setMarks(cachedMarks ?? []);
  }, [cachedUrl, cachedMarks]);

  /**
   * One audio element, created once and reused.
   *
   * Persistent rather than built per URL so it can be unlocked during the tap,
   * before any network call. Building it after an await is why the play button
   * needed pressing twice: the browser only allows audio to start inside the
   * gesture that asked for it, and by then the gesture was over.
   */
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audioRef.current = audio;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setElapsedSeconds(audio.currentTime);
    const onEnded = () => {
      if (loopingRef.current) {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      setIsPlaying(false);
    };
    const onError = () => {
      // The silent unlock clip fires an error on some browsers. Ignore it.
      if (!audio.src || audio.src.startsWith("data:")) return;
      setError("Couldn't play that narration.");
      setIsPlaying(false);
    };

    /**
     * Running out of downloaded audio part-way through.
     *
     * "In frequency I played abundance, it got stuck at 19 sec." The file for
     * that track is fine — 47 sentences, 179 seconds, all present. What ran
     * out was the download, not the audio.
     *
     * Until now nothing listened for this, so a stall was indistinguishable
     * from a crash: the clock froze, the voice stopped, and the app looked
     * dead. Saying "still loading" is the difference between a slow connection
     * and a broken app.
     */
    const onWaiting = () => {
      setIsBuffering(true);
      trail("narration", "buffering", { at: Math.round(audio.currentTime) });
    };
    const onPlaying = () => setIsBuffering(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplaythrough", onPlaying);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplaythrough", onPlaying);
      audioRef.current = null;
    };
  }, []);

  // Point it at the file. A src change, not a construction, so whatever
  // permission the tap earned survives.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    audio.src = audioUrl;

    if (playWhenReadyRef.current) {
      playWhenReadyRef.current = false;
      void audio
        .play()
        .then(() => setIsPlaying(true))
        // iOS refuses if too long has passed since the tap. Leave it ready.
        .catch(() => setIsPlaying(false));
    }
  }, [audioUrl]);

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

  /**
   * Claim permission to make sound, synchronously, inside the tap.
   *
   * Must be called from the click handler before anything is awaited. Playing
   * a few milliseconds of silence is enough for the browser to mark this
   * element as user-initiated.
   */
  const unlock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.src) return;
    audio.src = SILENT_WAV;
    void audio.play().catch(() => undefined);
  }, []);

  const fetchNarration = useCallback(
    async (voice: string): Promise<void> => {
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
        throw new Error(detail?.message ?? "Studio narration isn't available.");
      }

      const result = (await response.json()) as { audioUrl: string; marks: number[] | null };
      setAudioUrl(result.audioUrl);
      setMarks(result.marks ?? []);
    },
    [storyId],
  );

  /** Deduplicated, so the prefetch and the play button share one request. */
  const request = useCallback(
    (voice: string): Promise<void> => {
      if (inFlightRef.current) return inFlightRef.current;
      const promise = fetchNarration(voice).finally(() => {
        inFlightRef.current = null;
      });
      inFlightRef.current = promise;
      return promise;
    },
    [fetchNarration],
  );

  const generate = useCallback(
    async (voice = "sarah", playWhenReady = false) => {
      if (!storyId || !body.trim()) return false;
      playWhenReadyRef.current = playWhenReady;
      setIsGenerating(true);
      setError(null);
      trail("narration", "generate:start", { voice, playWhenReady });

      try {
        await request(voice);
        trail("narration", "generate:ok");
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
   * Start generating when the screen opens, so pressing play is usually free.
   *
   * This is what replaces the split. Rather than starting playback before the
   * audio exists, it starts the work before the person asks — which buys the
   * same few seconds without ever producing a gap mid-track.
   */
  const prepare = useCallback(
    async (voice = "sarah") => {
      if (!storyId || !body.trim() || audioUrl) return;

      // Reports as generating, so the play button shows a spinner from the
      // moment the screen opens rather than only once it's pressed. Tapping
      // into a button that looks idle but isn't is what "it feels like it got
      // hanged" was — and the work had usually already started.
      setIsGenerating(true);
      try {
        await request(voice);
        trail("narration", "prefetched");
      } catch {
        // Pressing play tries again and shows a message if it fails.
      } finally {
        setIsGenerating(false);
      }
    },
    [audioUrl, body, request, storyId],
  );

  const play = useCallback((fromSentence = 0) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Fall back to zero rather than leaving the position alone. Without this,
    // a track with no sentence marks — which happens whenever the alignment
    // didn't come back — would "replay" from wherever it stopped, i.e. from
    // the very end, and appear to hang.
    const target = marksRef.current?.[fromSentence] ?? 0;
    audio.currentTime = target;

    void audio.play();
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
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
    isBuffering,
    error,
    generate,
    prepare,
    unlock,
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
