import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { mappingSchema, padIndex } from '@/mapping/schema';
import { BUILTIN_PRESETS } from '@/mapping/presets';
import { FALLBACKS, resolve } from '@/mapping/resolve';
import { VOICES, voiceLabel, type Voice } from '@/mapping/voices';

const maschine = BUILTIN_PRESETS.find((p) => p.id === 'maschine-logic')!.mapping;

describe('mapping schema', () => {
  test('built-in presets validate', () => {
    expect(BUILTIN_PRESETS.map((p) => p.mapping.pads.length)).toEqual([16, 16]);
  });

  test('P3: mapping schema rejects duplicate notes, out-of-grid pads, unknown voices', () => {
    const issues = (m: unknown) => {
      const r = mappingSchema.safeParse(m);
      return r.success ? '' : r.error.issues.map((i) => i.message).join(' | ');
    };
    const pads = maschine.pads;
    expect(issues({ ...maschine, pads: [pads[0], { ...pads[1], note: pads[0]!.note }] })).toMatch(
      /note 24 is used by pads 1 and 2/,
    );
    expect(issues({ ...maschine, pads: [{ ...pads[0], row: 4 }] })).toMatch(/outside the 4×4 grid/);
    expect(issues({ ...maschine, pads: [{ ...pads[0], voice: 'gong' }] })).toMatch(/unknown voice/);
    expect(
      issues({ ...maschine, pads: [pads[0], { ...pads[1], row: pads[0]!.row, col: pads[0]!.col }] }),
    ).toMatch(/two pads at row 3, column 0/);
    expect(issues({ ...maschine, channel: 17 })).not.toBe('');
  });

  test('P3: maschine-logic preset matches logic.js PAD_ALIASES for notes 24-39', () => {
    const src = readFileSync(join(process.cwd(), 'logic.js'), 'utf8');
    const block = /var PAD_ALIASES = \{([\s\S]*?)\};/.exec(src)![1]!;
    const aliases = [...block.matchAll(/(\d+):\s*DEFAULT_MAPPINGS\.(\w+)/g)].map(
      (m) => [Number(m[1]), m[2]] as const,
    );
    expect(aliases).toHaveLength(16);

    // Drum Kit Designer voice → Drumr voice. hhOpenEdge follows the CC strip (RULE B in HandleMIDI).
    const DKD: Record<string, Voice> = {
      kick: 'kick',
      snareCenter: 'snare.center',
      hhShank: 'hihat.shank',
      hhClosedTip: 'hihat.closed',
      rimshot: 'snare.rimshot',
      sideStick: 'snare.sidestick',
      hhOpenEdge: 'hihat.cc',
      highTom: 'tom.high',
      highMidTom: 'tom.highMid',
      lowMidTom: 'tom.lowMid',
      lowTom: 'tom.low',
      crashLeft: 'crash.left',
      crashRight: 'crash.right',
      rideIn: 'ride.bow',
      rideBell: 'ride.bell',
    };
    aliases.forEach(([note, dkd], i) => {
      const pad = maschine.pads.find((p) => p.note === note)!;
      expect(pad.voice, `note ${note}`).toBe(DKD[dkd!]);
      // logic.js lists hardware rows bottom-up, four pads per row; row 0 on screen is the top.
      expect([pad.row, pad.col], `note ${note}`).toEqual([3 - Math.floor(i / 4), i % 4]);
    });
    expect(maschine.velocity).toEqual({ exponent: 2.4, floor: 28, ceiling: 127 }); // CURVE, MIN_VELOCITY, full range
    expect(maschine.hihat).toMatchObject({ cc: 1, invert: true }); // HIHAT_CONTROLLER, INVERT_HIHAT_MOD
    expect(padIndex(maschine, maschine.pads[0]!)).toBe(12); // note 24 = bottom-left
  });

  test('every voice has a label', () => {
    for (const v of VOICES) expect(voiceLabel(v)).toBeTruthy();
  });
});

describe('resolve', () => {
  test('P3: resolve returns exact match, documented fallbacks, and null for unavailable', () => {
    const only = (...ids: string[]) => ({ available: new Set(ids) });
    expect(resolve('kick', only('kick'))).toBe('kick');
    expect(resolve('cowbell', only('kick'))).toBeNull();
    expect(resolve('crash.leftChoke', only('crash.left'))).toBeNull();

    // Table-driven over the whole fallback table: with only the n-th alternative available, it is chosen.
    for (const [voice, alts] of Object.entries(FALLBACKS) as [Voice, string[]][]) {
      alts.forEach((alt, n) => {
        const later = alts.slice(n); // earlier alternatives missing
        expect(resolve(voice, { available: new Set(later) }), `${voice} → ${alt}`).toBe(alt);
      });
      expect(resolve(voice, only()), voice).toBeNull();
    }
  });

  test('hihat.cc picks an available openness level by index, clamped, defaulting to most open', () => {
    const ctx = {
      available: new Set(['hihat.closed', 'hihat.half', 'hihat.open']),
      hihatOpenness: ['hihat.closed', 'hihat.half', 'hihat.threeQuarter', 'hihat.open'],
    };
    expect(resolve('hihat.cc', ctx)).toBe('hihat.open');
    expect(resolve('hihat.cc', { ...ctx, hihatLevel: 0 })).toBe('hihat.closed');
    expect(resolve('hihat.cc', { ...ctx, hihatLevel: 1 })).toBe('hihat.half');
    expect(resolve('hihat.cc', { ...ctx, hihatLevel: 99 })).toBe('hihat.open');
    expect(resolve('hihat.cc', { ...ctx, hihatLevel: -3 })).toBe('hihat.closed');
    expect(resolve('hihat.cc', { available: new Set(['hihat.half']) })).toBe('hihat.half'); // no openness list → hihat.open fallbacks
  });
});
