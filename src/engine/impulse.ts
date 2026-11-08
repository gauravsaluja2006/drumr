/**
 * Synthetic reverb impulse responses: decaying stereo noise that darkens as it decays, with a few
 * early reflections for rooms. Generated in a few milliseconds, so no IR files are shipped.
 */
export interface ReverbShape {
  /** Impulse length in seconds. */
  seconds: number;
  /** Time for the tail to fall 60 dB, in seconds. */
  rt60: number;
  /** Silence before the reverb starts, in seconds. */
  predelay: number;
  /** One-pole low-pass coefficient (0–1, higher is brighter) at the start and at the end. */
  brightStart: number;
  brightEnd: number;
  /** Discrete early reflections spread over [predelay, earlyUntil]. */
  early: number;
  earlyUntil: number;
}

export type ReverbId = 'room' | 'hall' | 'plate';

export const REVERB_SHAPES: Readonly<Record<ReverbId, ReverbShape>> = {
  room: {
    seconds: 1,
    rt60: 0.6,
    predelay: 0.004,
    brightStart: 0.55,
    brightEnd: 0.2,
    early: 8,
    earlyUntil: 0.045,
  },
  hall: {
    seconds: 3.2,
    rt60: 2.4,
    predelay: 0.022,
    brightStart: 0.45,
    brightEnd: 0.08,
    early: 6,
    earlyUntil: 0.08,
  },
  plate: { seconds: 2.2, rt60: 1.6, predelay: 0, brightStart: 0.9, brightEnd: 0.45, early: 0, earlyUntil: 0 },
};

const FADE_IN = 0.003;

/** Fills `channels` (each `length` samples) with the impulse. Channels get independent noise. */
export function fillImpulse(
  channels: Float32Array[],
  sampleRate: number,
  shape: ReverbShape,
  random: () => number = Math.random,
): void {
  const pre = Math.round(shape.predelay * sampleRate);
  for (const data of channels) {
    const n = data.length;
    const fadeIn = Math.max(1, Math.round(FADE_IN * sampleRate));
    const fadeOutFrom = Math.floor(n * 0.9);
    let y = 0;
    for (let i = 0; i < n; i++) {
      if (i < pre) {
        data[i] = 0;
        continue;
      }
      const t = (i - pre) / sampleRate;
      const progress = i / n;
      const a = shape.brightStart + (shape.brightEnd - shape.brightStart) * progress;
      y += a * (random() * 2 - 1 - y);
      let env = Math.pow(10, (-3 * t) / shape.rt60);
      if (i - pre < fadeIn) env *= (i - pre) / fadeIn;
      if (i >= fadeOutFrom) env *= (n - 1 - i) / (n - 1 - fadeOutFrom);
      data[i] = y * env;
    }
    const span = shape.earlyUntil - shape.predelay;
    for (let k = 0; k < shape.early && span > 0; k++) {
      const at = pre + Math.floor(random() * span * sampleRate);
      if (at < n) data[at] = (data[at] ?? 0) + (random() < 0.5 ? -1 : 1) * (0.9 - (0.5 * k) / shape.early);
    }
  }
}

/** Impulse length in samples for a shape at a sample rate. */
export function impulseLength(shape: ReverbShape, sampleRate: number): number {
  return Math.round(shape.seconds * sampleRate);
}
