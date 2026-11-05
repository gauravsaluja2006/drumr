import { describe, expect, test } from 'vitest';
import {
  DEFAULT_ROTATION,
  intervalMs,
  nextKitId,
  nextSwitchAt,
  rotationKits,
  tapTempo,
} from '@/kits/rotation';

describe('kit rotation', () => {
  const index = ['a', 'b', 'c', 'd'];

  test('rotationKits keeps ticked kits in index order and falls back to every kit', () => {
    expect(rotationKits(index, ['d', 'b'])).toEqual(['b', 'd']);
    expect(rotationKits(index, [])).toEqual(index);
    // Kits that are no longer in the index are ignored; if nothing valid is ticked, rotate all.
    expect(rotationKits(index, ['gone'])).toEqual(index);
    expect(rotationKits(index, ['gone', 'c'])).toEqual(['c']);
  });

  test('nextKitId wraps in both directions and starts from the ends when the current kit is not in the list', () => {
    expect(nextKitId(['b', 'd'], 'b')).toBe('d');
    expect(nextKitId(['b', 'd'], 'd')).toBe('b');
    expect(nextKitId(['b', 'd'], 'b', -1)).toBe('d');
    expect(nextKitId(['b', 'd'], 'a')).toBe('b');
    expect(nextKitId(['b', 'd'], 'a', -1)).toBe('d');
    expect(nextKitId(['b', 'd'], null)).toBe('b');
    expect(nextKitId([], 'a')).toBeNull();
    expect(nextKitId(['a'], 'a')).toBeNull(); // nothing else to switch to
  });

  test('intervalMs is seconds in seconds mode and bars × 4 beats at the tempo in bars mode', () => {
    expect(intervalMs({ ...DEFAULT_ROTATION, mode: 'seconds', seconds: 15 })).toBe(15_000);
    expect(intervalMs({ ...DEFAULT_ROTATION, mode: 'bars', bars: 4, bpm: 120 })).toBe(8_000);
    expect(intervalMs({ ...DEFAULT_ROTATION, mode: 'bars', bars: 2, bpm: 90 })).toBeCloseTo(5_333.33, 1);
  });

  test('nextSwitchAt is the first grid point strictly after now', () => {
    expect(nextSwitchAt(1_000, 1_000, 500)).toBe(1_500);
    expect(nextSwitchAt(1_200, 1_000, 500)).toBe(1_500);
    expect(nextSwitchAt(1_500, 1_000, 500)).toBe(2_000);
    expect(nextSwitchAt(500, 1_000, 500)).toBe(1_000); // anchor in the future
  });

  test('tapTempo averages the recent run of taps and anchors the bar on its first tap', () => {
    expect(tapTempo([1_000])).toBeNull();
    expect(tapTempo([1_000, 1_500, 2_000, 2_500])).toEqual({ bpm: 120, anchor: 1_000 });
    // A gap longer than 2 s starts a new run.
    expect(tapTempo([0, 500, 5_000, 5_600, 6_200])).toEqual({ bpm: 100, anchor: 5_000 });
    // Tempo comes from the last 8 taps; the anchor stays on the run's first tap.
    const slowThenFast = [0, 1_000, 2_000, ...Array.from({ length: 8 }, (_, i) => 2_500 + i * 500)];
    expect(tapTempo(slowThenFast)).toEqual({ bpm: 120, anchor: 0 });
    // Clamped to 40–240.
    expect(tapTempo([0, 100])).toEqual({ bpm: 240, anchor: 0 });
    expect(tapTempo([0, 2_000])).toEqual({ bpm: 40, anchor: 0 });
  });
});
