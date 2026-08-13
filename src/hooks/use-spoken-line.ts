import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { reportError, trail } from "@/lib/telemetry";

/**
 * Reads a short line aloud in Sarah's voice.
 *
 * Replaces `useSpeech`, which used the browser's own speech synthesis. That was
 * the robotic voice on the affirmations screen and on Today's Moment: the story
 * player has used ElevenLabs for weeks, but these two screens never did, so two
 * of the three places you can press play sounded like a satnav.
 *
 * There is deliberately no fallback to the browser voice. It was the thing that
 * made the app feel cheap, and a silent failure with a message is better than
 * quietly substituting the voice we're trying to get rid of.
 *
 * Audio is cached server-side by the text itself, so replaying a line — or
 * playing one that another user has already played — costs nothing and is
 * instant.
 */
export function useSpokenLine() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Which line is in flight, so a fast double-tap can't leave an orphan playing.
  const requestRef = useRef(0);

  const stop = useCallback(() => {
    requestRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;

      stop();
      const request = requestRef.current;
      setIsLoading(true);
      setError(null);
      trail("voice", "line:start", { chars: clean.length });

      try {
        const { data, error: fnError } = await supabase.functions.invoke("speak-line", {
          body: { text: clean, voice: "sarah" },
        });
        // Superseded by a later tap while we were waiting.
        if (request !== requestRef.current) return;

        if (fnError) throw fnError;
        const audioUrl = (data as { audioUrl?: string } | null)?.audioUrl;
        if (!audioUrl) throw new Error("No audio came back.");

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.addEventListener("ended", () => setIsSpeaking(false));
        audio.addEventListener("error", () => {
          setError("Couldn't play that.");
          setIsSpeaking(false);
        });

        await audio.play();
        if (request !== requestRef.current) {
          audio.pause();
          return;
        }
        setIsSpeaking(true);
        trail("voice", "line:ok");
      } catch (err) {
        if (request !== requestRef.current) return;
        setError("Couldn't read that aloud just now.");
        reportError(err, { feature: "voice", phase: "speak-line" });
      } finally {
        if (request === requestRef.current) setIsLoading(false);
      }
    },
    [stop],
  );

  const toggle = useCallback(
    (text: string) => {
      if (isSpeaking || isLoading) stop();
      else void speak(text);
    },
    [isLoading, isSpeaking, speak, stop],
  );

  return {
    speak: (text: string) => void speak(text),
    stop,
    toggle,
    isSpeaking,
    isLoading,
    error,
    // Always true: this is a network call, not a browser capability. Kept so
    // the call sites that guarded on `isSupported` don't need restructuring.
    isSupported: true,
  };
}
