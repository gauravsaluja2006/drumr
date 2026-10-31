import { describe, expect, test } from 'vitest';
import { clamp, dbToGain, gainToDb, median, percentile } from '@/lib/audioMath';

describe('audioMath', () => {
  test('dbToGain / gainToDb', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(dbToGain(-Infinity)).toBe(0);
    expect(dbToGain(-200)).toBe(0);
    expect(gainToDb(1)).toBe(0);
    expect(gainToDb(0)).toBe(-Infinity);
  });
  test('percentiles', () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(clamp(5, 0, 3)).toBe(3);
  });
});
