/**
 * Calm background pad, synthesised in the browser with Web Audio.
 *
 * Deliberately not an audio file: no licensing question, nothing to download,
 * works offline, and it can run indefinitely without looping audibly. It's a
 * slow drifting chord through a soft filter — meant to sit under narration
 * without ever pulling attention.
 */

type Layer = {
  osc: OscillatorNode;
  gain: GainNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
};

const FADE_SECONDS = 2.5;

/** A gentle open voicing — root, fifth, octave, third. No dissonance to notice. */
const INTERVALS = [1, 1.5, 2, 2.5, 3];
const ROOT_HZ = 110; // A2

export class AmbientPad {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Layer[] = [];
  private targetVolume = 0.16;

  get isPlaying(): boolean {
    return this.context !== null && this.context.state === "running" && this.layers.length > 0;
  }

  /** Must be called from a user gesture — browsers block audio otherwise. */
  async start(volume = 0.16): Promise<void> {
    this.targetVolume = volume;
    if (this.layers.length > 0) {
      await this.context?.resume();
      this.rampMaster(volume);
      return;
    }

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const context = new Ctor();
    await context.resume();

    const master = new GainNode(context, { gain: 0 });

    // Rolls the top off so it reads as warmth rather than a synth tone.
    const filter = new BiquadFilterNode(context, {
      type: "lowpass",
      frequency: 620,
      Q: 0.6,
    });

    // Short diffuse delay gives it space without needing an impulse response.
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
    this.targetVolume = volume;
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
  async stop(): Promise<void> {
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

/** One pad for the whole app — two would beat against each other. */
let shared: AmbientPad | null = null;

export function ambientPad(): AmbientPad {
  if (!shared) shared = new AmbientPad();
  return shared;
}
