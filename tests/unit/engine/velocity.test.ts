import { describe, expect, test } from 'vitest';
import {
  curve,
  DEFAULT_CURVE,
  exponentToSensitivity,
  gainFor,
  layerFor,
  pickRoundRobin,
  sensitivityToExponent,
} from '@/engine/velocity';

describe('velocity', () => {
  test('P1: velocity.curve matches logic.js values for 1, 28, 64, 100, 127', () => {
    // Expected values computed with scaleVelocity() from logic.js (CURVE 2.4, MIN_VELOCITY 28).
    expect([1, 28, 64, 100, 127].map((v) => curve(v, DEFAULT_CURVE))).toEqual([28, 68, 95, 115, 127]);
  });

  test('curve honours custom exponent and floor', () => {
    expect(curve(64, { exponent: 1, floor: 0 })).toBe(64);
    expect(curve(1, { exponent: 1, floor: 10 })).toBe(10);
  });

  test('P1: velocity.layerFor returns the layer containing v and throws on gaps', () => {
    const layers = [
      { lovel: 1, hivel: 40, samples: ['a'] },
      { lovel: 41, hivel: 100, samples: ['b'] },
    ];
    expect(layerFor(1, layers).samples).toEqual(['a']);
    expect(layerFor(40, layers).samples).toEqual(['a']);
    expect(layerFor(41, layers).samples).toEqual(['b']);
    expect(() => layerFor(101, layers)).toThrow(RangeError);
  });

  test('gainFor is linear and clamped', () => {
    expect(gainFor(127)).toBe(1);
    expect(gainFor(0)).toBe(0);
    expect(gainFor(200)).toBe(1);
    expect(gainFor(63.5)).toBeCloseTo(0.5);
  });

  test('P1: pickRoundRobin never returns the same index twice in a row when >1 samples', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const count of [2, 3, 4]) {
      let last: number | undefined;
      const seen = new Set<number>();
      for (let i = 0; i < 500; i++) {
        const pick = pickRoundRobin(count, last, random);
        expect(pick).not.toBe(last);
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(count);
        seen.add(pick);
        last = pick;
      }
      expect(seen.size).toBe(count);
    }
  });

  test('pickRoundRobin returns 0 for single sample and handles out-of-range last', () => {
    expect(pickRoundRobin(1, 0)).toBe(0);
    expect(pickRoundRobin(0, undefined)).toBe(0);
    expect(pickRoundRobin(3, 9, () => 0.99)).toBe(2);
  });
});

describe('pad sensitivity', () => {
  test('ceiling makes lighter hits reach full velocity; 127 matches logic.js', () => {
    const linear = { exponent: 1, floor: 0 };
    expect(curve(64, { ...linear, ceiling: 64 })).toBe(127);
    expect(curve(32, { ...linear, ceiling: 64 })).toBe(64);
    expect(curve(100, { ...linear, ceiling: 64 })).toBe(127);
    expect(curve(64, { ...linear, ceiling: 127 })).toBe(64);
    expect([1, 28, 64, 100, 127].map((v) => curve(v, { exponent: 2.4, floor: 28, ceiling: 127 }))).toEqual([
      28, 68, 95, 115, 127,
    ]);
  });

  test('sensitivity percent maps onto the curve exponent and back', () => {
    expect(sensitivityToExponent(0)).toBe(1);
    expect(sensitivityToExponent(100)).toBe(4);
    expect(sensitivityToExponent(150)).toBe(4);
    expect(sensitivityToExponent(47)).toBe(2.4);
    expect(exponentToSensitivity(2.4)).toBe(47);
    expect(exponentToSensitivity(1)).toBe(0);
    // Higher sensitivity lifts a soft hit more.
    const soft = (p: number) => curve(20, { exponent: sensitivityToExponent(p), floor: 0 });
    expect(soft(0)).toBeLessThan(soft(50));
    expect(soft(50)).toBeLessThan(soft(100));
  });
});
