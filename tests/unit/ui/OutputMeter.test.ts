import { describe, expect, test } from 'vitest';
import { peakToLevel } from '@/ui/Mixer/OutputMeter';

describe('output meter', () => {
  test('maps peak to a 48 dB scale', () => {
    expect(peakToLevel(0)).toBe(0);
    expect(peakToLevel(1)).toBe(1);
    expect(peakToLevel(2)).toBe(1);
    expect(peakToLevel(10 ** (-24 / 20))).toBeCloseTo(0.5);
    expect(peakToLevel(10 ** (-60 / 20))).toBe(0);
  });
});
