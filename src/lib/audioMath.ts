export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Decibels to linear gain. -Infinity and anything ≤ -120 dB is silence. */
export function dbToGain(db: number): number {
  if (!Number.isFinite(db) || db <= -120) return 0;
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  return gain <= 0 ? -Infinity : 20 * Math.log10(gain);
}

export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

/** Nearest-rank percentile; returns 0 for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[clamp(rank - 1, 0, sorted.length - 1)] ?? 0;
}
