/**
 * Where the chosen device voice is remembered.
 *
 * This file used to export a `useSpeech` hook built on the browser's speech
 * synthesis, and the affirmations screen and Today's Moment both used it — so
 * they spoke in the flat robotic voice while the story player used Sarah. The
 * hook is gone rather than deprecated: leaving a working robot voice in reach
 * is how it got used in two places without anyone noticing.
 *
 * What remains is the stored voice name, still needed by the story player's
 * fallback and by the voice picker in Settings.
 */

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
