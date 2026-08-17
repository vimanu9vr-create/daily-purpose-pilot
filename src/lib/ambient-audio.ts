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
 * ## Why not `audio.loop = true`
 *
 * Reported: "in frequency it pauses, doesn't play properly." Measurable rather
 * than subjective — every tone file is 30.04 seconds when it should be exactly
 * 30. That 40ms is encoder padding: MP3 cannot represent an arbitrary length,
 * so every encoder pads the ends with silence. `audio.loop` replays that
 * padding on every lap, so a frequency session ticks every thirty seconds.
 *
 * ## Why not two <audio> elements either
 *
 * That was my first fix, and it caused "while playing frequencies it stops
 * playing suddenly". Two elements per layer, two layers for a frequency
 * session, plus the narration and the silent unlocker, is six concurrently
 * decoding elements. Mobile browsers cap that — and the ones over the cap
 * don't error, they just quietly refuse to play. Fixing a tick by adding
 * elements traded a small flaw for a total failure.
 *
 * ## Web Audio, decoded once
 *
 * One `AudioBufferSourceNode` with `loop = true` loops at sample boundaries,
 * so there is no padding and no seam by construction — nothing to cross-fade
 * because nothing is ever cut. One node instead of two elements, and decoding
 * happens once instead of continuously.
 *
 * The file header used to say Web Audio "did not work" on iPhone. That was
 * true and the diagnosis was wrong: the cause was the physical silent switch,
 * not the API. `unlockAudioSession()` handles that now by keeping a silent
 * <audio> element playing, which moves the page onto the playback audio
 * session. Web Audio on top of that is fine — and it's what a continuous tone
 * actually needs.
 */
class LoopingLayer {
  /** Shared across every layer — see `play()`. */
  private static shared: AudioContext | null = null;
  private static watchingVisibility = false;

  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private src = "";
  private token = 0;

  /** Decoded files, shared across every layer. Decoding is the expensive part. */
  private static buffers = new Map<string, Promise<AudioBuffer>>();

  private static decode(context: AudioContext, src: string): Promise<AudioBuffer> {
    const existing = LoopingLayer.buffers.get(src);
    if (existing) return existing;

    const promise = fetch(src)
      .then((response) => response.arrayBuffer())
      .then((bytes) => context.decodeAudioData(bytes));

    LoopingLayer.buffers.set(src, promise);
    return promise;
  }

  play(src: string, volume: number): void {
    if (typeof window === "undefined") return;

    // Same source already running: change the level, don't restart it.
    if (this.source && this.src === src) {
      this.setVolume(volume);
      return;
    }

    this.stop();
    this.src = src;

    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    // One context for every layer. Browsers cap how many a page may have, and
    // a frequency session alone wants three — tone, air, and the pad.
    LoopingLayer.shared ??= new Ctor();
    const context = LoopingLayer.shared;
    void context.resume().catch(() => undefined);
    this.context = context;

    /**
     * Phones suspend an AudioContext when the screen locks or the tab drops
     * into the background, and it does not come back on its own. A sleep
     * track that goes silent the moment the screen dims is the whole feature
     * failing at exactly the point it matters.
     */
    if (!LoopingLayer.watchingVisibility) {
      LoopingLayer.watchingVisibility = true;
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) void LoopingLayer.shared?.resume().catch(() => undefined);
      });
    }

    const gain = context.createGain();
    gain.gain.value = clamp(volume);
    gain.connect(context.destination);
    this.gain = gain;

    // Guards against a slow decode landing after the layer has been stopped
    // or pointed somewhere else — otherwise a track you've left starts
    // playing over the one you're on.
    this.token += 1;
    const token = this.token;

    void LoopingLayer.decode(context, src)
      .then((buffer) => {
        if (token !== this.token) return;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
        this.source = source;
      })
      .catch(() => {
        // Decode or fetch failed. Silence is better than a crash, and the
        // narration is the part that carries the session anyway.
      });
  }

  setVolume(volume: number): void {
    if (!this.gain || !this.context) return;
    // Ramped rather than set. An instant gain change on a sustained tone is an
    // audible click, which on a 528 Hz track is worse than the wrong level.
    const target = clamp(volume);
    this.gain.gain.cancelScheduledValues(this.context.currentTime);
    this.gain.gain.setTargetAtTime(target, this.context.currentTime, 0.08);
  }

  stop(): void {
    this.token += 1;
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // Already stopped.
      }
      this.source.disconnect();
      this.source = null;
    }
    this.gain?.disconnect();
    this.gain = null;
    this.src = "";
  }

  get playing(): boolean {
    return Boolean(this.source);
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
