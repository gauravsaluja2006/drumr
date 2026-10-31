/** Velocity handling. The curve is a direct port of scaleVelocity() in logic.js. */
export interface VelocityCurve {
  exponent: number;
  floor: number;
  /**
   * Input velocity treated as the hardest possible hit (127). Lower it so lighter hits reach full
   * volume. 127 (default) reproduces logic.js exactly.
   */
  ceiling?: number;
}

export const DEFAULT_CURVE: VelocityCurve = { exponent: 2.4, floor: 28, ceiling: 127 };

/** Exponent range the Sensitivity control spans: 1 = linear (0 %) … 4 = strong soft-hit boost (100 %). */
export const MIN_EXPONENT = 1;
export const MAX_EXPONENT = 4;

export function sensitivityToExponent(percent: number): number {
  const p = Math.min(100, Math.max(0, percent));
  return Math.round((MIN_EXPONENT + ((MAX_EXPONENT - MIN_EXPONENT) * p) / 100) * 10) / 10;
}

export function exponentToSensitivity(exponent: number): number {
  return Math.round(((exponent - MIN_EXPONENT) / (MAX_EXPONENT - MIN_EXPONENT)) * 100);
}

export interface VelocityLayer<T = string> {
  lovel: number;
  hivel: number;
  samples: readonly T[];
}

export function curve(v: number, { exponent, floor, ceiling = 127 }: VelocityCurve = DEFAULT_CURVE): number {
  const norm = Math.min(1, v / Math.max(1, ceiling));
  const scaled = Math.round(Math.pow(norm, 1 / exponent) * 127);
  return Math.min(127, Math.max(floor, scaled));
}

export function layerFor<T>(v: number, layers: readonly VelocityLayer<T>[]): VelocityLayer<T> {
  const layer = layers.find((l) => v >= l.lovel && v <= l.hivel);
  if (!layer) throw new RangeError(`No velocity layer covers velocity ${v}`);
  return layer;
}

/** Linear gain for a velocity, applied on top of the sample's own recorded dynamics. */
export function gainFor(v: number): number {
  return Math.min(1, Math.max(0, v / 127));
}

/**
 * Round-robin choice: uniform among the indices other than `last` when there is more than one sample.
 * `random` is injectable for deterministic tests.
 */
export function pickRoundRobin(
  count: number,
  last: number | undefined,
  random: () => number = Math.random,
): number {
  if (count <= 1) return 0;
  if (last === undefined || last < 0 || last >= count) return Math.floor(random() * count);
  const pick = Math.floor(random() * (count - 1));
  return pick >= last ? pick + 1 : pick;
}
