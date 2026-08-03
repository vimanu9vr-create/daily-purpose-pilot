/**
 * Speech engine wrapping the Web Speech API.
 *
 * Three browser problems this exists to solve:
 *
 * 1. `getVoices()` returns an empty array on first call — the list arrives
 *    asynchronously via `voiceschanged`. Selecting a voice synchronously
 *    silently falls back to the default robotic one. We await the list.
 *
 * 2. Chrome stops speaking after roughly 15 seconds of a single utterance,
 *    with no error and no `onend`. A three-minute story just dies mid-sentence.
 *    We queue one utterance per sentence instead of one per story.
 *
 * 3. Chrome also pauses synthesis when the tab is backgrounded, and needs a
 *    periodic `resume()` nudge to keep going.
 */

let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Resolves once the browser has actually populated its voice list. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;

  voicesPromise = new Promise((resolve) => {
    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length > 0) {
      resolve(immediate);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", finish);
    // Some browsers never fire the event; don't hang forever.
    setTimeout(finish, 1500);
  });

  return voicesPromise;
}

/**
 * Ranked preference. Neural/premium voices first, then known-good named
 * voices, then any local English voice. Local voices avoid the network
 * round-trip that makes remote voices stutter.
 */
function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  let score = 0;

  if (!voice.lang.toLowerCase().startsWith("en")) return -1;

  // If a Sara/Sarah voice exists on this device, it wins.
  if (/\bsara(h)?\b/.test(name)) score += 100;

  if (/neural|natural|premium|enhanced|siri/.test(name)) score += 60;
  if (/google/.test(name)) score += 30;
  if (/microsoft/.test(name)) score += 20;
  if (/samantha|serena|allison|ava|jenny|aria|karen|moira|zira|sonia|libby/.test(name)) score += 40;
  if (voice.localService) score += 15;
  if (/compact|espeak|robot/.test(name)) score -= 40;
  if (voice.default) score += 5;

  return score;
}

/** How slowly and how much space between lines. Calm is the default. */
export type Pace = "calm" | "gentle" | "natural";

export const PACE_SETTINGS: Record<Pace, { rate: number; gapMs: number; paragraphGapMs: number }> =
  {
    // Meditation-app slow, with room to breathe between lines.
    calm: { rate: 0.72, gapMs: 900, paragraphGapMs: 1600 },
    gentle: { rate: 0.82, gapMs: 550, paragraphGapMs: 1000 },
    natural: { rate: 0.95, gapMs: 260, paragraphGapMs: 500 },
  };

const PACE_STORAGE_KEY = "manifestai:pace";

export function storedPace(): Pace {
  if (typeof window === "undefined") return "calm";
  const value = window.localStorage.getItem(PACE_STORAGE_KEY);
  return value === "gentle" || value === "natural" ? value : "calm";
}

export function storePace(pace: Pace) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PACE_STORAGE_KEY, pace);
}

export async function bestVoice(
  preferredName?: string | null,
): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  if (voices.length === 0) return null;

  if (preferredName) {
    const exact = voices.find((v) => v.name === preferredName);
    if (exact) return exact;
  }

  const ranked = voices
    .map((voice) => ({ voice, score: scoreVoice(voice) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.voice ?? voices[0] ?? null;
}

/** Voices worth offering in a picker — English, best first, deduped by name. */
export async function selectableVoices(): Promise<SpeechSynthesisVoice[]> {
  const voices = await loadVoices();
  const seen = new Set<string>();
  return voices
    .map((voice) => ({ voice, score: scoreVoice(voice) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .filter((entry) => {
      if (seen.has(entry.voice.name)) return false;
      seen.add(entry.voice.name);
      return true;
    })
    .map((entry) => entry.voice)
    .slice(0, 12);
}

export type SpeakOptions = {
  /** Spoken one at a time, which is what dodges Chrome's 15-second cutoff. */
  sentences: string[];
  /** Marks which sentences begin a new paragraph, so those get a longer pause. */
  paragraphStarts?: Set<number>;
  pace?: Pace;
  rate?: number;
  pitch?: number;
  voiceName?: string | null;
  startAt?: number;
  onSentenceStart?: (index: number) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
};

export type SpeechHandle = { cancel: () => void };

/** Speaks a sentence queue. Returns a handle so callers can cancel cleanly. */
export async function speakSentences(options: SpeakOptions): Promise<SpeechHandle> {
  if (!isSpeechSupported()) {
    options.onError?.("unsupported");
    return { cancel: () => {} };
  }

  const paceSettings = PACE_SETTINGS[options.pace ?? storedPace()];
  const {
    sentences,
    rate = paceSettings.rate,
    // Slightly under 1 reads as settled rather than bright.
    pitch = 0.96,
    voiceName,
    startAt = 0,
    paragraphStarts,
  } = options;

  window.speechSynthesis.cancel();

  const voice = await bestVoice(voiceName);
  let cancelled = false;
  let index = Math.max(0, Math.min(sentences.length - 1, startAt));

  // Chrome pauses synthesis unpredictably; this nudge keeps it alive.
  const keepAlive = setInterval(() => {
    if (cancelled) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10_000);

  function cleanup() {
    clearInterval(keepAlive);
  }

  function speakNext() {
    if (cancelled) return cleanup();

    if (index >= sentences.length) {
      cleanup();
      options.onDone?.();
      return;
    }

    const text = sentences[index]!;
    options.onSentenceStart?.(index);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 1;
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (cancelled) return;
      index += 1;
      // Silence between lines is what makes this feel like guided narration
      // instead of a screen reader working through a paragraph.
      const gap = paragraphStarts?.has(index) ? paceSettings.paragraphGapMs : paceSettings.gapMs;
      setTimeout(speakNext, gap);
    };

    utterance.onerror = (event) => {
      if (cancelled) return;
      // "interrupted" and "canceled" are our own cancel() landing; ignore.
      if (event.error === "interrupted" || event.error === "canceled") {
        cleanup();
        return;
      }
      // Skip a bad sentence rather than stalling the whole story.
      index += 1;
      setTimeout(speakNext, paceSettings.gapMs);
    };

    window.speechSynthesis.speak(utterance);
  }

  speakNext();

  return {
    cancel: () => {
      cancelled = true;
      cleanup();
      window.speechSynthesis.cancel();
    },
  };
}
