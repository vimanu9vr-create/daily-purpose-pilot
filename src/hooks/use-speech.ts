import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Read text aloud using the browser's built-in speech synthesis.
 *
 * Deliberately not a paid text-to-speech API: this costs nothing, works
 * offline, and needs no key. The voice is less warm than a hosted neural
 * voice — that's the trade, and it's the right one until people are paying.
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      // Speaking while already speaking queues rather than replaces, so clear first.
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.88; // slower than default — this is meant to be sat with
      utterance.pitch = 1;
      utterance.volume = 1;

      // Prefer a natural-sounding local voice when one exists.
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /samantha|serena|allison|ava|jenny|aria/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith("en") && v.localService) ??
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    },
    [isSupported],
  );

  const toggle = useCallback(
    (text: string) => {
      if (isSpeaking) stop();
      else speak(text);
    },
    [isSpeaking, speak, stop],
  );

  return { speak, stop, toggle, isSpeaking, isSupported };
}
