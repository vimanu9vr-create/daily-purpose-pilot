/**
 * Background sound: the ambient bed, and the tones for frequency sessions.
 *
 * These used to be synthesised live with Web Audio oscillators. That was
 * elegant and it did not work. Three rounds of "there's no background music"
 * on a real iPhone — while the ElevenLabs narration on the very same screen
 * played fine. That contrast is the whole diagnosis: narration goes through an
 * <audio> element, the pad went through an AudioContext. One worked, one
 * didn't, so both now go through <audio>. Less clever, audible.
 *
 * The tones are recordings of the real frequency — a 528 Hz file really is
 * 528 Hz, with a soft sub-octave under it so it reads as warm rather than as a
 * thin test tone. Every file is built from whole-number frequencies, so it
 * loops without a seam.
 *
 * The one Web Audio lesson worth keeping: iPhones mute audio when the physical
 * silent switch is on, and playing a silent clip first moves the page onto the
 * playback audio session. Without it, anyone with their ringer off hears
 * nothing and concludes the app is broken.
 */

const PAD_SRC = "/audio/ambient-pad.mp3";

/** Frequencies we ship a real recording for. */
const TONE_FILES: Record<number, string> = {
  528: "/audio/tone-528.mp3",
  639: "/audio/tone-639.mp3",
  888: "/audio/tone-888.mp3",
  963: "/audio/tone-963.mp3",
};

/** One-frame silent WAV. Playing this escapes the iOS silent switch. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let silentUnlocker: HTMLAudioElement | null = null;

/**
 * Call synchronously from a click or tap, before any await.
 * Makes audio audible even with the ringer switched off.
 */
export function unlockAudioSession(): void {
  if (typeof window === "undefined") return;
  try {
    if (!silentUnlocker) {
      silentUnlocker = new Audio(SILENT_WAV);
      silentUnlocker.loop = true;
      silentUnlocker.volume = 0.001;
      silentUnlocker.setAttribute("playsinline", "true");
    }
    void silentUnlocker.play().catch(() => {
      // Blocked, or already playing. Not worth surfacing.
    });
  } catch {
    // Ignore.
  }
}

/** A looping background layer backed by one audio element. */
class LoopingLayer {
  private audio: HTMLAudioElement | null = null;

  play(src: string, volume: number): void {
    if (typeof window === "undefined") return;

    // Same source already running: just set the level, don't restart it.
    if (this.audio && this.audio.src.endsWith(src) && !this.audio.paused) {
      this.setVolume(volume);
      return;
    }

    this.stop();

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = clamp(volume);
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    this.audio = audio;

    void audio.play().catch(() => {
      // Refused because we're too far from the tap. Leave it loaded so the
      // next press works, rather than throwing an error at the user.
    });
  }

  setVolume(volume: number): void {
    if (this.audio) this.audio.volume = clamp(volume);
  }

  stop(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.audio = null;
  }

  get playing(): boolean {
    return Boolean(this.audio && !this.audio.paused);
  }
}

function clamp(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}

export class AmbientPad {
  private layer = new LoopingLayer();

  start(volume = 0.16): void {
    unlockAudioSession();
    this.layer.play(PAD_SRC, volume);
  }

  setVolume(volume: number): void {
    this.layer.setVolume(volume);
  }

  stop(): void {
    this.layer.stop();
  }

  get isPlaying(): boolean {
    return this.layer.playing;
  }
}

export class ToneGenerator {
  private layer = new LoopingLayer();

  /**
   * Plays a frequency session's tone. Falls back to the ambient bed for a
   * frequency we don't ship a file for, so a track is never silent.
   */
  start(frequencyHz: number, volume = 0.2): void {
    unlockAudioSession();
    this.layer.play(TONE_FILES[frequencyHz] ?? PAD_SRC, volume);
  }

  setVolume(volume: number): void {
    this.layer.setVolume(volume);
  }

  stop(): void {
    this.layer.stop();
  }

  get isPlaying(): boolean {
    return this.layer.playing;
  }
}

let padInstance: AmbientPad | null = null;
let toneInstance: ToneGenerator | null = null;

export function ambientPad(): AmbientPad {
  if (!padInstance) padInstance = new AmbientPad();
  return padInstance;
}

export function toneGenerator(): ToneGenerator {
  if (!toneInstance) toneInstance = new ToneGenerator();
  return toneInstance;
}

/** Pulls "528" out of "Renewal 528 Hz". */
export function frequencyFromTitle(title: string): number | null {
  const match = title.match(/(\d{2,4})\s*Hz/i);
  if (!match) return null;
  const hz = Number(match[1]);
  return hz >= 20 && hz <= 20_000 ? hz : null;
}
