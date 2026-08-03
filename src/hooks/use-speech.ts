import { useCallback, useEffect, useRef, useState } from "react";

import { isSpeechSupported, speakSentences, type SpeechHandle } from "@/lib/speech-engine";

const VOICE_STORAGE_KEY = "manifestai:voice";

export function storedVoiceName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(VOICE_STORAGE_KEY);
}

export function storeVoiceName(name: string | null) {
  if (typeof window === "undefined") return;
  if (name) window.localStorage.setItem(VOICE_STORAGE_KEY, name);
  else window.localStorage.removeItem(VOICE_STORAGE_KEY);
}

/**
 * Reads short text aloud — affirmations, single lines.
 *
 * Goes through the shared engine so it picks up a real voice (rather than the
 * default robotic one) and survives Chrome's mid-utterance cutoff.
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const handleRef = useRef<SpeechHandle | null>(null);

  useEffect(() => {
    setIsSupported(isSpeechSupported());
  }, []);

  const stop = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    setIsSpeaking(false);
  }, []);

  useEffect(() => stop, [stop]);

  const speak = useCallback((text: string) => {
    if (!isSpeechSupported()) return;
    handleRef.current?.cancel();
    setIsSpeaking(true);

    // Split so even a long affirmation doesn't hit the cutoff.
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    void speakSentences({
      sentences: sentences.length > 0 ? sentences : [text],
      voiceName: storedVoiceName(),
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    }).then((handle) => {
      handleRef.current = handle;
    });
  }, []);

  const toggle = useCallback(
    (text: string) => {
      if (isSpeaking) stop();
      else speak(text);
    },
    [isSpeaking, speak, stop],
  );

  return { speak, stop, toggle, isSpeaking, isSupported };
}
