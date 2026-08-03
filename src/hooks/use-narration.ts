import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Narrates a story and reports which sentence is being spoken, so the player
 * can show the text in sync with the voice.
 *
 * Chrome fires `onboundary` per word, which gives exact positions. Safari
 * mostly doesn't, so there's a timer fallback that advances on an estimate of
 * words-per-minute. The fallback is less precise but never leaves the text
 * frozen while audio plays, which is the failure that would actually be noticed.
 */

const WORDS_PER_MINUTE = 150;

export type NarrationState = {
  isPlaying: boolean;
  isSupported: boolean;
  /** Index into `sentences`. */
  currentIndex: number;
  elapsedSeconds: number;
  totalSeconds: number;
  looping: boolean;
};

export function splitSentences(body: string): string[] {
  return body
    .split(/\n\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function useNarration(body: string) {
  const sentences = useMemo(() => splitSentences(body), [body]);

  const totalWords = useMemo(() => body.split(/\s+/).filter(Boolean).length, [body]);
  const totalSeconds = Math.max(30, Math.round((totalWords / WORDS_PER_MINUTE) * 60));

  const [isSupported, setIsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [looping, setLooping] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopingRef = useRef(false);
  const startFromRef = useRef(0);

  // Sentence start offsets in characters, used to map boundary events back.
  const offsets = useMemo(() => {
    const result: number[] = [];
    let cursor = 0;
    for (const sentence of sentences) {
      const found = body.indexOf(sentence, cursor);
      const at = found === -1 ? cursor : found;
      result.push(at);
      cursor = at + sentence.length;
    }
    return result;
  }, [body, sentences]);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    loopingRef.current = false;
    clearTick();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  }, [clearTick]);

  // Never leave a voice running when the component unmounts.
  useEffect(() => stop, [stop]);

  const play = useCallback(
    (fromSentence = 0) => {
      if (!isSupported || sentences.length === 0) return;

      window.speechSynthesis.cancel();
      clearTick();

      const from = Math.max(0, Math.min(sentences.length - 1, fromSentence));
      startFromRef.current = from;
      setCurrentIndex(from);

      const text = sentences.slice(from).join(" ");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.02;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /samantha|serena|allison|ava|jenny|aria|karen/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith("en") && v.localService) ??
        voices.find((v) => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      const baseOffset = offsets[from] ?? 0;
      let sawBoundary = false;

      utterance.onboundary = (event) => {
        sawBoundary = true;
        const absolute = baseOffset + event.charIndex;
        let index = from;
        for (let i = from; i < offsets.length; i += 1) {
          if ((offsets[i] ?? 0) <= absolute) index = i;
          else break;
        }
        setCurrentIndex(index);
      };

      utterance.onend = () => {
        clearTick();
        if (loopingRef.current) {
          play(0);
          return;
        }
        setIsPlaying(false);
        setCurrentIndex(sentences.length - 1);
        setElapsedSeconds(totalSeconds);
      };

      utterance.onerror = () => {
        clearTick();
        setIsPlaying(false);
      };

      // Elapsed clock, plus the Safari fallback for advancing sentences.
      const startedAt = Date.now();
      const secondsBefore = sentenceStartSeconds(sentences, from);
      setElapsedSeconds(secondsBefore);

      tickRef.current = setInterval(() => {
        const elapsed = secondsBefore + (Date.now() - startedAt) / 1000;
        setElapsedSeconds(Math.min(totalSeconds, elapsed));

        if (!sawBoundary) {
          let acc = 0;
          let index = 0;
          for (let i = 0; i < sentences.length; i += 1) {
            acc += sentenceSeconds(sentences[i]!);
            if (elapsed < acc) {
              index = i;
              break;
            }
            index = i;
          }
          setCurrentIndex(index);
        }
      }, 250);

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    },
    [clearTick, isSupported, offsets, sentences, totalSeconds],
  );

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else play(currentIndex);
  }, [currentIndex, isPlaying, play, stop]);

  /** Jump by roughly ten seconds, in sentences. */
  const skip = useCallback(
    (seconds: number) => {
      const target = Math.max(0, elapsedSeconds + seconds);
      let acc = 0;
      let index = 0;
      for (let i = 0; i < sentences.length; i += 1) {
        acc += sentenceSeconds(sentences[i]!);
        index = i;
        if (target < acc) break;
      }
      if (isPlaying) play(index);
      else {
        setCurrentIndex(index);
        setElapsedSeconds(sentenceStartSeconds(sentences, index));
      }
    },
    [elapsedSeconds, isPlaying, play, sentences],
  );

  const seekToSentence = useCallback(
    (index: number) => {
      if (isPlaying) play(index);
      else {
        setCurrentIndex(index);
        setElapsedSeconds(sentenceStartSeconds(sentences, index));
      }
    },
    [isPlaying, play, sentences],
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

function sentenceSeconds(sentence: string): number {
  const words = sentence.split(/\s+/).filter(Boolean).length;
  return (words / WORDS_PER_MINUTE) * 60;
}

function sentenceStartSeconds(sentences: string[], index: number): number {
  let total = 0;
  for (let i = 0; i < index; i += 1) total += sentenceSeconds(sentences[i]!);
  return total;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
