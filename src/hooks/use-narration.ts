import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isSpeechSupported, speakSentences, type SpeechHandle } from "@/lib/speech-engine";

import { storedVoiceName } from "./use-speech";

/**
 * Narrates a story sentence by sentence and reports which one is speaking.
 *
 * Sync comes from the queue itself — each sentence is its own utterance, so
 * `onSentenceStart` is exact on every browser. That replaces the old
 * `onboundary` approach, which Safari largely ignores, and it's also what
 * dodges Chrome's ~15-second cutoff on long utterances.
 */

const WORDS_PER_MINUTE = 145;

export function splitSentences(body: string): string[] {
  return body
    .split(/\n\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function sentenceSeconds(sentence: string): number {
  const words = sentence.split(/\s+/).filter(Boolean).length;
  return (words / WORDS_PER_MINUTE) * 60;
}

export function useNarration(body: string) {
  const sentences = useMemo(() => splitSentences(body), [body]);

  const durations = useMemo(() => sentences.map(sentenceSeconds), [sentences]);
  const starts = useMemo(() => {
    const result: number[] = [];
    let acc = 0;
    for (const d of durations) {
      result.push(acc);
      acc += d;
    }
    return result;
  }, [durations]);
  const totalSeconds = useMemo(() => durations.reduce((a, b) => a + b, 0), [durations]);

  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [looping, setLooping] = useState(false);

  const handleRef = useRef<SpeechHandle | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopingRef = useRef(false);
  const sentenceStartedAt = useRef(0);
  const activeIndex = useRef(0);

  useEffect(() => {
    setIsSupported(isSpeechSupported());
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    loopingRef.current = false;
    setLooping(false);
    clearTick();
    handleRef.current?.cancel();
    handleRef.current = null;
    setIsPlaying(false);
  }, [clearTick]);

  useEffect(() => {
    return () => {
      clearTick();
      handleRef.current?.cancel();
    };
  }, [clearTick]);

  const play = useCallback(
    (fromSentence = 0) => {
      if (!isSpeechSupported() || sentences.length === 0) return;

      handleRef.current?.cancel();
      clearTick();

      const from = Math.max(0, Math.min(sentences.length - 1, fromSentence));
      activeIndex.current = from;
      setCurrentIndex(from);
      setElapsedSeconds(starts[from] ?? 0);
      setIsPlaying(true);

      // Smooth the clock between sentence callbacks.
      sentenceStartedAt.current = Date.now();
      tickRef.current = setInterval(() => {
        const base = starts[activeIndex.current] ?? 0;
        const within = (Date.now() - sentenceStartedAt.current) / 1000;
        const cap = durations[activeIndex.current] ?? 0;
        setElapsedSeconds(Math.min(totalSeconds, base + Math.min(within, cap)));
      }, 200);

      void speakSentences({
        sentences,
        startAt: from,
        voiceName: storedVoiceName(),
        onSentenceStart: (index) => {
          activeIndex.current = index;
          sentenceStartedAt.current = Date.now();
          setCurrentIndex(index);
          setElapsedSeconds(starts[index] ?? 0);
        },
        onDone: () => {
          clearTick();
          if (loopingRef.current) {
            play(0);
            return;
          }
          setIsPlaying(false);
          setElapsedSeconds(totalSeconds);
        },
        onError: () => {
          clearTick();
          setIsPlaying(false);
        },
      }).then((handle) => {
        handleRef.current = handle;
      });
    },
    [clearTick, durations, sentences, starts, totalSeconds],
  );

  const toggle = useCallback(() => {
    if (isPlaying) {
      clearTick();
      handleRef.current?.cancel();
      handleRef.current = null;
      setIsPlaying(false);
    } else {
      play(currentIndex);
    }
  }, [clearTick, currentIndex, isPlaying, play]);

  const indexForTime = useCallback(
    (seconds: number) => {
      let index = 0;
      for (let i = 0; i < starts.length; i += 1) {
        if ((starts[i] ?? 0) <= seconds) index = i;
        else break;
      }
      return index;
    },
    [starts],
  );

  const skip = useCallback(
    (seconds: number) => {
      const target = Math.max(0, Math.min(totalSeconds, elapsedSeconds + seconds));
      const index = indexForTime(target);
      if (isPlaying) play(index);
      else {
        setCurrentIndex(index);
        activeIndex.current = index;
        setElapsedSeconds(starts[index] ?? 0);
      }
    },
    [elapsedSeconds, indexForTime, isPlaying, play, starts, totalSeconds],
  );

  const seekToSentence = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(sentences.length - 1, index));
      if (isPlaying) play(clamped);
      else {
        setCurrentIndex(clamped);
        activeIndex.current = clamped;
        setElapsedSeconds(starts[clamped] ?? 0);
      }
    },
    [isPlaying, play, sentences.length, starts],
  );

  const toggleLoop = useCallback(() => {
    setLooping((prev) => {
      loopingRef.current = !prev;
      return !prev;
    });
  }, []);

  return {
    sentences,
    currentSentence: sentences[currentIndex] ?? "",
    currentIndex,
    isPlaying,
    isSupported,
    elapsedSeconds,
    totalSeconds,
    looping,
    play,
    stop,
    toggle,
    skip,
    seekToSentence,
    toggleLoop,
  };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
