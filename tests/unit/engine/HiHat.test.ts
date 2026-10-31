import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { BANDS, dkdArticulation, HiHatState, levelIndex, opennessBand } from '@/engine/HiHat';
import { resolve } from '@/mapping/resolve';

/** Runs the original updateHiHat() from logic.js and returns CURRENT_HIHAT_ARTICULATION. */
function logicJsUpdateHiHat(): (value: number, invert: boolean) => number {
  const src = readFileSync(join(process.cwd(), 'logic.js'), 'utf8');
  const fn = /function updateHiHat\(value\) \{[\s\S]*?\n\}/.exec(src)![0];
  return new Function(
    'value',
    'INVERT_HIHAT_MOD',
    `let CURRENT_HIHAT_ARTICULATION; ${fn}; updateHiHat(value); return CURRENT_HIHAT_ARTICULATION;`,
  ) as (value: number, invert: boolean) => number;
}

describe('hi-hat openness', () => {
  test('P4: HiHat band mapping reproduces logic.js updateHiHat thresholds for invert on and off', () => {
    const original = logicJsUpdateHiHat();
    for (const invert of [true, false]) {
      for (let value = 0; value <= 127; value++) {
        expect(dkdArticulation(value, invert), `value ${value} invert ${invert}`).toBe(
          original(value, invert),
        );
      }
    }
    // Articulation 7 = closed, 1 = open in Drum Kit Designer → bands 0..6.
    expect([0, 20, 40, 60, 80, 100, 127].map((v) => opennessBand(v, true))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect([0, 20, 40, 60, 80, 100, 127].map((v) => opennessBand(v, false))).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });

  test('P4: HiHat maps 7 bands onto 2, 3, 4 and 6 available levels monotonically', () => {
    for (const levels of [2, 3, 4, 6]) {
      const mapped = Array.from({ length: BANDS }, (_, band) => levelIndex(band, levels));
      expect(mapped[0]).toBe(0);
      expect(mapped[BANDS - 1]).toBe(levels - 1);
      for (let b = 1; b < BANDS; b++) expect(mapped[b]).toBeGreaterThanOrEqual(mapped[b - 1]!);
      expect(new Set(mapped).size).toBe(levels); // every level reachable
    }
    expect(levelIndex(3, 1)).toBe(0);
    expect([0, 1, 2, 3, 4, 5, 6].map((b) => levelIndex(b, 4))).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });

  test('P4: resolve(hihat.cc) returns the openness level for the current CC band', () => {
    const openness = ['hihat.closed', 'hihat.half', 'hihat.threeQuarter', 'hihat.open'];
    const available = new Set(openness);
    const state = new HiHatState();
    const at = (value: number | null) => {
      state.value = value;
      return resolve('hihat.cc', {
        available,
        hihatOpenness: openness,
        hihatLevel: state.level(true, openness.length),
      });
    };
    expect(at(null)).toBe('hihat.open'); // no CC yet: most open, like logic.js (articulation 1)
    expect(at(0)).toBe('hihat.closed');
    expect(at(30)).toBe('hihat.half');
    expect(at(70)).toBe('hihat.threeQuarter');
    expect(at(127)).toBe('hihat.open');
    expect(state.band(false)).toBe(0);
  });
});
