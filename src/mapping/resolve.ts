import type { Voice } from './voices';

/**
 * Voice → kit articulation (docs/02-ARCHITECTURE.md §3.4). First available id wins.
 * Additions beyond the doc: hihat.open → ¾ → half, crash.left → crash.right, and toms search
 * outward by distance in [high, highMid, lowMid, low].
 */
export const FALLBACKS: Readonly<Partial<Record<Voice, readonly string[]>>> = {
  'snare.edge': ['snare.center'],
  'snare.rimshot': ['snare.center'],
  'snare.sidestick': ['snare.rimshot', 'snare.center'],
  'tom.high': ['tom.highMid', 'tom.lowMid', 'tom.low'],
  'tom.highMid': ['tom.high', 'tom.lowMid', 'tom.low'],
  'tom.lowMid': ['tom.low', 'tom.highMid', 'tom.high'],
  'tom.low': ['tom.lowMid', 'tom.highMid', 'tom.high'],
  'hihat.half': ['hihat.threeQuarter', 'hihat.open'],
  'hihat.threeQuarter': ['hihat.open'],
  'hihat.open': ['hihat.threeQuarter', 'hihat.half'],
  'hihat.shank': ['hihat.closed'],
  'hihat.splash': ['hihat.open'],
  'hihat.pedal': ['hihat.closed'],
  'ride.edge': ['ride.bow'],
  'ride.bell': ['ride.bow'],
  'crash.left': ['crash.right'],
  'crash.right': ['crash.left'],
  china: ['crash.left', 'crash.right'],
  splash: ['crash.left', 'crash.right'],
};

export interface ResolveContext {
  available: ReadonlySet<string>;
  /** Kit openness levels closed → open (manifest `hihat.openness`), used by `hihat.cc`. */
  hihatOpenness?: readonly string[];
  /** Index into hihatOpenness chosen by the CC band; defaults to the most open level. */
  hihatLevel?: number;
}

export function resolve(voice: Voice, ctx: ResolveContext): string | null {
  if (voice === 'hihat.cc') {
    const levels = (ctx.hihatOpenness ?? []).filter((l) => ctx.available.has(l));
    if (levels.length === 0) return resolve('hihat.open', ctx);
    const i = Math.min(levels.length - 1, Math.max(0, ctx.hihatLevel ?? levels.length - 1));
    return levels[i] ?? null;
  }
  if (ctx.available.has(voice)) return voice;
  for (const alt of FALLBACKS[voice] ?? []) if (ctx.available.has(alt)) return alt;
  return null;
}
