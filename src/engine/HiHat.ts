/**
 * Hi-hat openness from a MIDI CC (docs/02-ARCHITECTURE.md §3.5).
 *
 * `dkdArticulation` is updateHiHat() from logic.js, verbatim. In Drum Kit Designer articulation 7
 * is fully closed and 1 is fully open (logic.js forces closed pads to 7 when INVERT_HIHAT_MOD is on).
 * So with invert off, a high CC closes the hat (hi-hat pedal semantics, e.g. CC4); with invert on,
 * a high CC opens it (a mod strip pushed up = open), which is the author's Maschine setup.
 */
export const BANDS = 7;

export function dkdArticulation(value: number, invert: boolean): number {
  if (value > 114) return invert ? 1 : 7;
  if (value > 94) return invert ? 2 : 6;
  if (value > 74) return invert ? 3 : 5;
  if (value > 54) return 4;
  if (value > 34) return invert ? 5 : 3;
  if (value > 14) return invert ? 6 : 2;
  return invert ? 7 : 1;
}

/** 0 = fully closed … 6 = fully open. */
export function opennessBand(value: number, invert: boolean): number {
  return BANDS - dkdArticulation(value, invert);
}

/** Maps a band onto the kit's available openness levels (index into hihat.openness, closed → open). */
export function levelIndex(band: number, levels: number): number {
  if (levels <= 1) return 0;
  return Math.round((band * (levels - 1)) / (BANDS - 1));
}

/** Current CC position. `null` until the first CC arrives, which plays the most open level. */
export class HiHatState {
  value: number | null = null;

  band(invert: boolean): number {
    return this.value === null ? BANDS - 1 : opennessBand(this.value, invert);
  }

  level(invert: boolean, levels: number): number {
    return levelIndex(this.band(invert), levels);
  }
}
