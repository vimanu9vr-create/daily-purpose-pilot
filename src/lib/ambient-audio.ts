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
export const SILENT_WAV =
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

/**
 * A background layer that loops without a gap.
 *
 * ## Why this isn't just `audio.loop = true`
 *
 * Reported: "in frequency it pauses, doesn't play properly." It does, and it's
 * measurable rather than subjective — every tone file is 30.04 seconds long
 * when it should be exactly 30. That extra 40 milliseconds is encoder padding:
 * the MP3 format cannot represent an arbitrary length, so every encoder pads
 * the start and end with silence. `audio.loop` replays that padding on every
 * lap, so a frequency session ticks audibly every thirty seconds. No amount of
 * re-exporting fixes it; it is a property of the format.
 *
 * So two elements play the same file in relay. Before one reaches the end the
 * other starts from the beginning, and they cross over during the overlap —
 * which both hides the padding and, for a continuous tone, hides the seam
 * entirely because the two are the same waveform.
 */
const CROSSFADE_SECONDS = 2;

class LoopingLayer {
  private elements: [HTMLAudioElement, HTMLAudioElement] | null = null;
  private active = 0;
  private volume = 0;
  private src = "";
  private timer: number | null = null;

  play(src: string, volume: number): void {
    if (typeof window === "undefined") return;

    // Same source already running: change the level, don't restart it.
    if (this.elements && this.src === src) {
      this.setVolume(volume);
      return;
    }

    this.stop();
    this.src = src;
    this.volume = clamp(volume);

    const make = () => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = 0;
      audio.setAttribute("playsinline", "true");
      return audio;
    };

    this.elements = [make(), make()];
    this.active = 0;
    this.elements[0].volume = this.volume;

    void this.elements[0].play().catch(() => {
      // Refused because we're too far from the tap. Leave it loaded so the
      // next press works rather than throwing an error at the user.
    });

    this.watch();
  }

  /**
   * Hand over before the file runs out.
   *
   * Polled rather than driven by `timeupdate`, because browsers fire that at
   * their own convenience — as little as four times a second, and less when
   * the tab is backgrounded. A missed handover is an audible gap, which is the
   * exact thing this exists to prevent.
   */
  private watch(): void {
    this.timer = window.setInterval(() => {
      const pair = this.elements;
      if (!pair) return;

      const current = pair[this.active]!;
      const other = pair[this.active === 0 ? 1 : 0]!;
      const duration = current.duration;
      if (!Number.isFinite(duration) || duration === 0) return;

      const remaining = duration - current.currentTime;
      if (remaining > CROSSFADE_SECONDS) return;

      if (other.paused) {
        other.currentTime = 0;
        other.volume = 0;
        void other.play().catch(() => undefined);
      }

      // Equal-power-ish crossover. A straight linear fade dips in the middle,
      // because two correlated signals at half amplitude are quieter than one
      // at full — and a dip in a continuous tone is as noticeable as a gap.
      const progress = Math.max(0, Math.min(1, 1 - remaining / CROSSFADE_SECONDS));
      current.volume = clamp(Math.cos((progress * Math.PI) / 2) * this.volume);
      other.volume = clamp(Math.sin((progress * Math.PI) / 2) * this.volume);

      if (remaining <= 0.12) {
        current.pause();
        current.currentTime = 0;
        current.volume = 0;
        other.volume = this.volume;
        this.active = this.active === 0 ? 1 : 0;
      }
    }, 100);
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume);
    const pair = this.elements;
    if (!pair) return;
    // Only the element in front. The other is mid-crossover and the poll owns
    // its level; writing to it here would produce an audible jump.
    const current = pair[this.active]!;
    if (pair[this.active === 0 ? 1 : 0]!.paused) current.volume = this.volume;
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    for (const audio of this.elements ?? []) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    this.elements = null;
    this.src = "";
  }

  get playing(): boolean {
    const pair = this.elements;
    return Boolean(pair && (!pair[0].paused || !pair[1].paused));
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

/**
 * A frequency session: the tone, with air around it.
 *
 * ## Why there are two layers here
 *
 * Reported: "background music is disgusting, it's not calm, it doesn't suit
 * the frequency." The tones themselves are correct — I checked the spectrum of
 * each file and 528 really is 528 Hz with a sub-octave under it. The problem
 * is that a sine wave and its octave, alone, is a *test tone*. It's what a
 * hearing test sounds like. Accurate and clinical are not the same as calm.
 *
 * Every frequency track people actually listen to puts the tone inside
 * something — a pad, a room, some movement. The tone is the point; the pad is
 * what makes it bearable for twenty minutes. So the pad now runs underneath at
 * about a third of the tone's level: not audible as music, audible as air.
 *
 * The tone stays exactly on pitch, which is the part that has to be true.
 */
export class ToneGenerator {
  private tone = new LoopingLayer();
  private air = new LoopingLayer();

  /**
   * How loud the pad sits under the tone.
   *
   * Low enough that it never competes with the frequency, high enough that the
   * tone stops sounding like it's coming out of a machine.
   */
  private static readonly AIR_RATIO = 0.35;

  /**
   * Plays a frequency session's tone. Falls back to the ambient bed alone for
   * a frequency we don't ship a file for, so a track is never silent.
   */
  start(frequencyHz: number, volume = 0.2): void {
    unlockAudioSession();

    const file = TONE_FILES[frequencyHz];
    if (!file) {
      this.tone.play(PAD_SRC, volume);
      return;
    }

    this.tone.play(file, volume);
    this.air.play(PAD_SRC, volume * ToneGenerator.AIR_RATIO);
  }

  setVolume(volume: number): void {
    this.tone.setVolume(volume);
    this.air.setVolume(volume * ToneGenerator.AIR_RATIO);
  }

  stop(): void {
    this.tone.stop();
    this.air.stop();
  }

  get isPlaying(): boolean {
    return this.tone.playing;
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
