import { useCallback, useEffect, useRef, useState } from "react";

import { trail } from "@/lib/telemetry";

/**
 * Voice-to-text, using the browser's own speech recognition.
 *
 * No API, no per-minute cost, and — the part that matters for a journal —
 * nothing to promise about where the audio goes, because we never handle it.
 * The browser does, and on iOS and Android that's the same engine the keyboard
 * dictation button uses.
 *
 * Support is genuinely patchy: Safari and Chrome have it under a prefix,
 * Firefox doesn't have it at all. So `supported` is exposed and the button
 * hides itself rather than appearing and failing. A dictation button that does
 * nothing is worse than no dictation button.
 *
 * Interim results are surfaced separately from final ones. Without that, the
 * text jumps around as the engine revises its guess mid-sentence, which looks
 * broken even though it's working.
 */

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
};

function getRecogniser(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const constructor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .webkitSpeechRecognition;
  return constructor ? new constructor() : null;
}

export function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);

  const recogniser = useRef<SpeechRecognitionLike | null>(null);
  // Held in a ref so restarting doesn't capture a stale callback — the text
  // would then append to whatever the field contained when listening began.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const instance = getRecogniser();
    setSupported(Boolean(instance));
    if (!instance) return;

    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || "en-US";

    instance.onresult = (event) => {
      let finalText = "";
      let pending = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]!;
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }

      setInterim(pending);
      if (finalText.trim()) onFinalRef.current(finalText);
    };

    instance.onerror = (event) => {
      trail("dictation", "error", { code: event.error ?? "unknown" });
      setListening(false);
    };

    instance.onend = () => {
      setListening(false);
      setInterim("");
    };

    recogniser.current = instance;

    return () => {
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      try {
        instance.stop();
      } catch {
        // Already stopped. Nothing to do.
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!recogniser.current || listening) return;
    try {
      recogniser.current.start();
      setListening(true);
      trail("dictation", "started");
    } catch {
      // Chrome throws if start() is called while already running.
      setListening(false);
    }
  }, [listening]);

  const stop = useCallback(() => {
    recogniser.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, start, stop, toggle: listening ? stop : start };
}
