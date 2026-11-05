/**
 * Kit rotation: switch to the next kit on a timer so a player can hear one groove on many kits
 * without stopping. Pure functions only; timers live in src/app/rotation.ts.
 */
export type RotationMode = 'seconds' | 'bars';

export interface RotationSettings {
  mode: RotationMode;
  seconds: number;
  bars: number;
  bpm: number;
  /** Kits to rotate through; empty means every kit. */
  kitIds: string[];
}

export const BEATS_PER_BAR = 4;
export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const SECONDS_CHOICES = [10, 15, 30, 60] as const;
export const BARS_CHOICES = [1, 2, 4, 8] as const;

export const DEFAULT_ROTATION: RotationSettings = {
  mode: 'seconds',
  seconds: 15,
  bars: 4,
  bpm: 120,
  kitIds: [],
};

/** Ticked kits in index order; every kit when none of the ticked ones exist. */
export function rotationKits(indexIds: readonly string[], ticked: readonly string[]): string[] {
  const set = new Set(ticked);
  const picked = indexIds.filter((id) => set.has(id));
  return picked.length > 0 ? picked : [...indexIds];
}

/** The kit after (or before) `current` in `list`, wrapping; null when there is nothing else to switch to. */
export function nextKitId(list: readonly string[], current: string | null, step: 1 | -1 = 1): string | null {
  const i = current === null ? -1 : list.indexOf(current);
  if (i === -1) return (step > 0 ? list[0] : list.at(-1)) ?? null;
  if (list.length < 2) return null;
  return list[(i + step + list.length) % list.length] ?? null;
}

export function intervalMs(s: Pick<RotationSettings, 'mode' | 'seconds' | 'bars' | 'bpm'>): number {
  return s.mode === 'seconds' ? s.seconds * 1000 : (s.bars * BEATS_PER_BAR * 60_000) / s.bpm;
}

/** First point of the grid `anchor + k × interval` that is strictly after `now`. */
export function nextSwitchAt(now: number, anchor: number, interval: number): number {
  if (anchor > now) return anchor;
  return anchor + (Math.floor((now - anchor) / interval) + 1) * interval;
}

const TAP_GAP_MS = 2000;
const MAX_TAPS = 8;

/**
 * Tempo from tap times (ms, ascending): the latest run of taps (gaps of at most 2 s), tempo from its
 * last 8. The run's first tap is taken as a downbeat so bar changes line up with how the player
 * counted in.
 */
export function tapTempo(taps: readonly number[]): { bpm: number; anchor: number } | null {
  let start = taps.length - 1;
  while (start > 0 && taps[start]! - taps[start - 1]! <= TAP_GAP_MS) start--;
  const run = taps.slice(start);
  if (run.length < 2) return null;
  const recent = run.slice(-MAX_TAPS);
  const avg = (recent.at(-1)! - recent[0]!) / (recent.length - 1);
  const bpm = Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, 60_000 / avg)));
  return { bpm, anchor: run[0]! };
}
