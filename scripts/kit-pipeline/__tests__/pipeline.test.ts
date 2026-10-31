import { beforeAll, describe, expect, test } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover, globToRegExp, selectLayers, subsample, velocityRanges } from '../discover';
import { recipeSchema, type Recipe } from '../recipe';
import { buildKit, planJobs } from '../build';
import { verifyKit } from '../verify';
import { decode, filePeak, firstFrameAbove, linearToDb, trim } from '../audio';
import { wav } from '../../lib/wav';
import { kitIndexSchema, kitManifestSchema } from '../../../src/kits/schema';

const SR = 44100;
const SILENCE_MS = 120;
const CLICK_AT = Math.round((SILENCE_MS / 1000) * SR);

/** A hit preceded by silence; amplitude scales with layer. */
function hit(amp: number, freq: number): Float32Array {
  const n = CLICK_AT + Math.round(0.15 * SR);
  return Float32Array.from({ length: n }, (_, i) =>
    i < CLICK_AT
      ? 0
      : amp *
        Math.sin((2 * Math.PI * freq * (i - CLICK_AT)) / SR + Math.PI / 2) *
        Math.exp(-(i - CLICK_AT) / (0.03 * SR)),
  );
}

let work: string;
let sources: string;
let out: string;

const recipe = (over: Partial<Record<string, unknown>> = {}): Recipe =>
  recipeSchema.parse({
    id: 'fixture-kit',
    name: 'Fixture',
    description: 'Pipeline test kit',
    license: { name: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    attribution: { author: 'tests', url: 'https://example.com/' },
    source: { libraryId: 'lib', root: 'Samples' },
    output: { channels: 1 },
    budget: { maxVelocityLayers: 3, maxRoundRobins: 2 },
    articulations: [
      { id: 'snare.center', group: 'snare', glob: 'snare/sn_vl{layer}_rr{rr}.wav' },
      {
        id: 'kick',
        group: 'kick',
        mix: [{ glob: 'kick/in/k_vl{layer}.wav' }, { glob: 'kick/oh/k_vl{layer}.wav', gainDb: -6 }],
      },
      { id: 'hihat.closed', group: 'hihat', chokeGroup: 'hihat', glob: 'hh/closed_{layer}.wav' },
      {
        id: 'hihat.open',
        group: 'hihat',
        chokeGroup: 'hihat',
        chokedBy: ['hihat.closed'],
        glob: 'hh/open_{layer}.wav',
      },
    ],
    hihat: { openness: ['hihat.closed', 'hihat.open'] },
    ...over,
  });

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'drumr-pipeline-'));
  sources = join(work, 'sources');
  out = join(work, 'out');
  const lib = join(sources, 'lib', 'Samples');
  const put = (rel: string, samples: Float32Array) => {
    mkdirSync(join(lib, rel, '..'), { recursive: true });
    writeFileSync(join(lib, rel), wav(samples, SR));
  };
  for (let l = 1; l <= 5; l++)
    for (let r = 1; r <= 3; r++) put(`snare/sn_vl${l}_rr${r}.wav`, hit(0.1 * l, 200 + r));
  for (let l = 1; l <= 2; l++) {
    put(`kick/in/k_vl${l}.wav`, hit(0.2 * l, 60));
    put(`kick/oh/k_vl${l}.wav`, hit(0.1 * l, 60));
    put(`hh/closed_${l}.wav`, hit(0.15 * l, 5000));
    put(`hh/open_${l}.wav`, hit(0.15 * l, 6000));
  }
  return () => rmSync(work, { recursive: true, force: true });
});

describe('kit pipeline: discovery and ranges', () => {
  test('P2: pipeline captures {layer} and {rr} and subsamples layers keeping lowest and highest', () => {
    expect(globToRegExp('a/{layer}_x*.wav').test('a/12_xyz.wav')).toBe(true);
    expect(globToRegExp('a/{layer}.wav').test('a/b/12.wav')).toBe(false);

    const files = [
      's/sn_vl10_rr1.wav',
      's/sn_vl2_rr2.wav',
      's/sn_vl2_rr1.wav',
      's/sn_vl1_rr1.wav',
      's/other.wav',
    ];
    expect(discover(files, 's/sn_vl{layer}_rr{rr}.wav')).toEqual([
      { path: 's/sn_vl1_rr1.wav', layer: 1, rr: 1 },
      { path: 's/sn_vl2_rr1.wav', layer: 2, rr: 1 },
      { path: 's/sn_vl2_rr2.wav', layer: 2, rr: 2 },
      { path: 's/sn_vl10_rr1.wav', layer: 10, rr: 1 },
    ]);
    expect(discover(['h/splash_rr3.wav'], 'h/splash_rr{rr}.wav')).toEqual([
      { path: 'h/splash_rr3.wav', layer: 1, rr: 3 },
    ]);

    expect(subsample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4)).toEqual([1, 4, 7, 10]);
    expect(
      subsample(
        [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
          28, 29, 30, 31, 32, 33, 34, 35, 36,
        ],
        6,
      ),
    ).toEqual([1, 8, 15, 22, 29, 36]);
    expect(subsample([1, 2], 4)).toEqual([1, 2]);
    expect(subsample([1, 2, 3], 1)).toEqual([3]);

    const found = Array.from({ length: 5 }, (_, l) =>
      [1, 2, 3].map((rr) => ({ path: `${l}-${rr}`, layer: l + 1, rr })),
    ).flat();
    const layers = selectLayers(found, 3, 2);
    expect(layers.map((rrs) => rrs.map((d) => d.path))).toEqual([
      ['0-1', '0-2'],
      ['2-1', '2-2'],
      ['4-1', '4-2'],
    ]);
  });

  test('P2: pipeline derives contiguous velocity ranges covering 1-127', () => {
    for (let n = 1; n <= 12; n++) {
      const ranges = velocityRanges(n);
      expect(ranges).toHaveLength(n);
      expect(ranges[0]![0]).toBe(1);
      expect(ranges.at(-1)![1]).toBe(127);
      for (let i = 1; i < n; i++) expect(ranges[i]![0]).toBe(ranges[i - 1]![1] + 1);
      for (const [lo, hi] of ranges) expect(hi).toBeGreaterThanOrEqual(lo);
    }
    expect(velocityRanges(4)).toEqual([
      [1, 31],
      [32, 63],
      [64, 95],
      [96, 127],
    ]);
    expect(() => velocityRanges(0)).toThrow();
  });

  test('planJobs aligns mix sources and rejects missing matches', () => {
    const files = ['kick/in/k_vl1.wav', 'kick/oh/k_vl1.wav', 'kick/in/k_vl2.wav'];
    const r = recipe({
      articulations: [
        {
          id: 'kick',
          group: 'kick',
          mix: [{ glob: 'kick/in/k_vl{layer}.wav' }, { glob: 'kick/oh/k_vl{layer}.wav' }],
        },
      ],
      hihat: undefined,
      normalize: { reference: 'kick' },
    });
    expect(() => planJobs(r, files)).toThrow(/missing a match/);
    expect(() => planJobs(r, [])).toThrow(/no files match/);
  });
});

describe('kit pipeline: build and verify (real ffmpeg)', () => {
  test('P2: pipeline trim keeps the first transient within 1 ms of file start', () => {
    buildKit(recipe(), { sourcesRoot: sources, outRoot: out });
    const manifest = kitManifestSchema.parse(
      JSON.parse(readFileSync(join(out, 'fixture-kit', 'manifest.json'), 'utf8')),
    );
    const samples = manifest.articulations.flatMap((a) => a.layers.flatMap((l) => l.samples));
    expect(samples.length).toBe(3 * 2 + 2 + 2 + 2);
    for (const s of samples) {
      const pcm = decode(join(out, 'fixture-kit', s), SR, 1);
      const first = firstFrameAbove(pcm, 0.01);
      expect(first, s).toBeGreaterThanOrEqual(0);
      expect(first / SR, s).toBeLessThanOrEqual(0.001 + 1 / SR);
    }
    // Unit-level: an exact click at frame 5000 lands at 1 ms after trim.
    const raw = new Float32Array(10000);
    raw[5000] = 0.9;
    const trimmed = trim(
      { channels: 1, sampleRate: SR, data: raw },
      { startThreshold: 0.01, endThreshold: 0.001, maxSeconds: 1, fadeOutMs: 0 },
    );
    expect(firstFrameAbove(trimmed, 0.01)).toBe(Math.round(0.001 * SR));
  });

  test('P2: pipeline normalisation offset brings reference peak to -6 dBFS ±1 dB', () => {
    const res = buildKit(recipe(), { sourcesRoot: sources, outRoot: out });
    expect(res.clipGuarded).toBe(false);
    expect(res.referencePeakDbfs).toBeCloseTo(-6, 1);
    const manifest = kitManifestSchema.parse(
      JSON.parse(readFileSync(join(out, 'fixture-kit', 'manifest.json'), 'utf8')),
    );
    const top = manifest.articulations.find((a) => a.id === 'snare.center')!.layers.at(-1)!;
    const measured = linearToDb(Math.max(...top.samples.map((s) => filePeak(join(out, 'fixture-kit', s)))));
    expect(Math.abs(measured - -6)).toBeLessThanOrEqual(1);
    // Internal balance preserved: the softest snare layer stays ~14 dB under the loudest (0.1 vs 0.5).
    const low = manifest.articulations.find((a) => a.id === 'snare.center')!.layers[0]!;
    expect(measured - linearToDb(filePeak(join(out, 'fixture-kit', low.samples[0]!)))).toBeCloseTo(14, 0);
    expect(existsSync(join(out, 'fixture-kit', 'provenance.json'))).toBe(true);

    const ok = verifyKit(join(out, 'fixture-kit'), {
      maxBytes: 5_000_000,
      reference: 'snare.center',
      targetPeakDbfs: -6,
    });
    expect(ok.errors).toEqual([]);
  });

  test('clip guard lowers kit gain when another sample would clip', () => {
    const res = buildKit(recipe({ normalize: { reference: 'hihat.closed', targetPeakDbfs: -1 } }), {
      sourcesRoot: sources,
      outRoot: out,
    });
    expect(res.clipGuarded).toBe(true);
    expect(res.referencePeakDbfs).toBeLessThan(-1);
  });

  test('P2: pipeline verify fails on missing file, overlap, over-budget, unknown chokedBy', () => {
    buildKit(recipe({ licenseText: 'CC-BY-SA notice' }), { sourcesRoot: sources, outRoot: out });
    const good = join(out, 'fixture-kit');
    expect(readFileSync(join(good, 'LICENSE.txt'), 'utf8')).toMatch(/CC-BY-SA/);
    const variant = (
      name: string,
      mutate: (m: Record<string, unknown> & { articulations: Record<string, unknown>[] }) => void,
    ) => {
      const dir = join(work, name);
      rmSync(dir, { recursive: true, force: true });
      cpSync(good, dir, { recursive: true });
      const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
      mutate(m);
      writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m));
      return dir;
    };
    const opts = { maxBytes: 5_000_000, structureOnly: true };

    expect(verifyKit(good, opts).ok).toBe(true);

    const missing = variant('missing', () => {});
    rmSync(join(missing, 'samples', 'kick_v1_rr1.flac'));
    expect(verifyKit(missing, opts).errors.join()).toMatch(/missing file: samples\/kick_v1_rr1.flac/);

    const overlap = variant('overlap', (m) => {
      const layers = m.articulations[0]!.layers as { lovel: number }[];
      layers[1]!.lovel = 10;
    });
    expect(verifyKit(overlap, opts).errors.join()).toMatch(/overlapping layers/);

    expect(verifyKit(good, { ...opts, maxBytes: 100 }).errors.join()).toMatch(/over budget/);

    const choke = variant('choke', (m) => {
      m.articulations[3]!.chokedBy = ['hihat.nope'];
    });
    expect(verifyKit(choke, opts).errors.join()).toMatch(/unknown chokedBy "hihat.nope"/);

    expect(
      verifyKit(good, { maxBytes: 5_000_000, reference: 'cowbell', targetPeakDbfs: -6 }).errors.join(),
    ).toMatch(/cowbell/);
  });
});

describe('shipped kits', () => {
  test('P2: public/kits/index.json entries all have manifests that validate and total ≤ 120 MB', () => {
    const root = join(process.cwd(), 'public/kits');
    const index = kitIndexSchema.parse(JSON.parse(readFileSync(join(root, 'index.json'), 'utf8')));
    expect(index.length).toBeGreaterThanOrEqual(3);
    let total = 0;
    for (const entry of index) {
      const manifest = kitManifestSchema.parse(
        JSON.parse(readFileSync(join(root, entry.id, 'manifest.json'), 'utf8')),
      );
      expect(manifest.totalBytes).toBe(entry.totalBytes);
      expect(manifest.totalBytes).toBeLessThanOrEqual(30_000_000);
      for (const s of manifest.articulations.flatMap((a) => a.layers.flatMap((l) => l.samples))) {
        expect(existsSync(join(root, entry.id, s)), s).toBe(true);
      }
      if (manifest.license.name.startsWith('CC-BY-SA'))
        expect(existsSync(join(root, entry.id, 'LICENSE.txt'))).toBe(true);
      total += manifest.totalBytes;
    }
    expect(total).toBeLessThanOrEqual(120_000_000);
  });
});
