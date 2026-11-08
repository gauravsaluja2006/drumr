import { describe, expect, test } from 'vitest';
import { REVERB_SHAPES, fillImpulse, impulseLength } from '@/engine/impulse';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const energy = (d: Float32Array, from: number, to: number) => {
  let e = 0;
  for (let i = from; i < to; i++) e += d[i]! * d[i]!;
  return e;
};

describe('reverb impulses', () => {
  test('each preset decays: the last quarter is far quieter than the first', () => {
    for (const shape of Object.values(REVERB_SHAPES)) {
      const n = impulseLength(shape, 8000);
      const l = new Float32Array(n);
      fillImpulse([l], 8000, shape, seeded());
      const q = Math.floor(n / 4);
      expect(energy(l, 0, q)).toBeGreaterThan(1000 * energy(l, 3 * q, n));
      expect(Math.abs(l[n - 1]!)).toBe(0); // faded to silence, no click at the end
    }
  });

  test('pre-delay is silent and stereo channels are decorrelated', () => {
    const shape = REVERB_SHAPES.hall;
    const n = impulseLength(shape, 8000);
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    fillImpulse([l, r], 8000, shape, seeded(7));
    const pre = Math.round(shape.predelay * 8000);
    expect(energy(l, 0, pre)).toBe(0);
    let dot = 0;
    for (let i = 0; i < n; i++) dot += l[i]! * r[i]!;
    expect(Math.abs(dot) / Math.sqrt(energy(l, 0, n) * energy(r, 0, n))).toBeLessThan(0.2);
  });
});
