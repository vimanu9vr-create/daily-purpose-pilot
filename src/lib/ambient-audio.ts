/**
 * Calm background pad and pure tones, synthesised in the browser.
 *
 * Two iOS constraints shape everything here, and both were bugs in the first
 * version:
 *
 * 1. An AudioContext must be *created* inside the user gesture. The previous
 *    code awaited a promise before constructing it, which put construction on
 *    a later tick — by then Safari no longer considers it user-initiated, and
 *    silently produces no sound. Construction is now synchronous.
 *
 * 2. iPhones mute Web Audio when the physical silent switch is on. The escape
 *    is to play a silent `<audio>` element first, which moves the page onto the
 *    playback audio session. Without this, someone with their ringer off just
 *    hears nothing and assumes the app is broken.
 */

type Layer = {
  osc: OscillatorNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

const FADE_SECONDS = 2.5;

/** A gentle open voicing — no dissonance to notice. */
const INTERVALS = [1, 1.5, 2, 2.5, 3];
const ROOT_HZ = 110; // A2

/** One-frame silent WAV. Playing this escapes the iOS silent switch. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let silentUnlocker: HTMLAudioElement | null = null;

/**
 * Call synchronously from a click/tap, before any await.
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

function createContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export class AmbientPad {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Layer[] = [];

  get isPlaying(): boolean {
    return this.layers.length > 0;
  }

  /**
   * Must be called directly from a user gesture. Everything up to and
   * including `new AudioContext()` runs synchronously for that reason.
   */
  start(volume = 0.16): void {
    unlockAudioSession();

    if (this.context) {
      void this.context.resume();
      this.rampMaster(volume);
      return;
    }

    const context = createContext();
    if (!context) return;

    // resume() is fire-and-forget; the context already exists by now, which is
    // what Safari actually checks.
    void context.resume();

    const master = new GainNode(context, { gain: 0 });

    // Rolls the top off so it reads as warmth rather than a synth tone.
    const filter = new BiquadFilterNode(context, { type: "lowpass", frequency: 620, Q: 0.6 });

    // Short diffuse delay gives it space without an impulse response.
    const delay = new DelayNode(context, { delayTime: 0.42, maxDelayTime: 1 });
    const feedback = new GainNode(context, { gain: 0.32 });
    const wet = new GainNode(context, { gain: 0.3 });

    filter.connect(master);
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(context.destination);

    this.layers = INTERVALS.map((interval, i) => {
      const osc = new OscillatorNode(context, {
        type: i % 2 === 0 ? "sine" : "triangle",
        frequency: ROOT_HZ * interval,
        // Slight detune per layer so it breathes instead of sitting still.
        detune: (i - 2) * 4,
      });
      const gain = new GainNode(context, { gain: 0.16 / (i + 1) });

      // Each layer swells on its own slow cycle, so the chord never repeats.
      const lfo = new OscillatorNode(context, { frequency: 0.035 + i * 0.011 });
      const lfoGain = new GainNode(context, { gain: 0.055 });
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      lfo.start();

      return { osc, gain, lfo, lfoGain };
    });

    this.context = context;
    this.master = master;
    this.rampMaster(volume);
  }

  setVolume(volume: number) {
    if (this.master && this.context) this.rampMaster(volume);
  }

  private rampMaster(volume: number) {
    if (!this.master || !this.context) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(volume, now + FADE_SECONDS);
  }

  /** Fades out, then tears down. Never cuts abruptly. */
  stop(): void {
    if (!this.context || !this.master) return;
    const context = this.context;
    const now = context.currentTime;

    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 1.2);

    const layers = this.layers;
    this.layers = [];
    this.master = null;
    this.context = null;

    setTimeout(() => {
      for (const layer of layers) {
        try {
          layer.osc.stop();
          layer.lfo.stop();
          layer.osc.disconnect();
          layer.lfo.disconnect();
          layer.gain.disconnect();
          layer.lfoGain.disconnect();
        } catch {
          // Already torn down.
        }
      }
      void context.close();
    }, 1400);
  }
}

/**
 * A single sustained tone — what a "528 Hz" track should actually be.
 *
 * Two oscillators a few cents apart, so it breathes slightly rather than
 * sitting perfectly still, which is fatiguing over several minutes.
 */
export class ToneGenerator {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];

  get isPlaying(): boolean {
    return this.oscillators.length > 0;
  }

  /** Call directly from a user gesture. */
  start(frequencyHz: number, volume = 0.12): void {
    unlockAudioSession();
    if (this.context) this.stop();

    const context = createContext();
    if (!context) return;
    void context.resume();

    const master = new GainNode(context, { gain: 0 });
    // Softens the edge so a long listen doesn't become piercing.
    const filter = new BiquadFilterNode(context, {
      type: "lowpass",
      frequency: Math.max(900, frequencyHz * 3),
      Q: 0.5,
    });
    filter.connect(master);
    master.connect(context.destination);

    // A slow tremolo, barely perceptible, to keep it from feeling synthetic.
    const lfo = new OscillatorNode(context, { frequency: 0.12 });
    const lfoGain = new GainNode(context, { gain: 0.02 });
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();

    this.oscillators = [-4, 4].map((cents) => {
      const osc = new OscillatorNode(context, {
        type: "sine",
        frequency: frequencyHz,
        detune: cents,
      });
      const gain = new GainNode(context, { gain: 0.5 });
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      return osc;
    });
    this.oscillators.push(lfo);

    const now = context.currentTime;
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(volume, now + 2);

    this.context = context;
    this.master = master;
  }

  stop(): void {
    if (!this.context || !this.master) return;
    const context = this.context;
    const now = context.currentTime;

    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 1);

    const oscillators = this.oscillators;
    this.oscillators = [];
    this.master = null;
    this.context = null;

    setTimeout(() => {
      for (const osc of oscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Already stopped.
        }
      }
      void context.close();
    }, 1200);
  }
}

/** One of each for the whole app — two would beat against each other. */
let sharedPad: AmbientPad | null = null;
let sharedTone: ToneGenerator | null = null;

export function ambientPad(): AmbientPad {
  if (!sharedPad) sharedPad = new AmbientPad();
  return sharedPad;
}

export function toneGenerator(): ToneGenerator {
  if (!sharedTone) sharedTone = new ToneGenerator();
  return sharedTone;
}

/** Pulls "528 Hz" out of a title so a frequency track knows what to play. */
export function frequencyFromTitle(title: string): number | null {
  const match = title.match(/(\d{2,4})\s*Hz/i);
  if (!match) return null;
  const hz = Number(match[1]);
  return hz >= 20 && hz <= 20_000 ? hz : null;
}
