import { describe, expect, test } from 'vitest';
import { Sampler } from '@/engine/Sampler';
import type { FetchLike } from '@/kits/loader';
import { FakeAudioContext } from '../fakes/FakeAudioContext';
import { testManifest } from '../fakes/kits';

/** Every sample is 100 bytes; paths listed in `missing` 404. */
const sampleFetch =
  (missing: string[] = [], log: string[] = []): FetchLike =>
  async (url) => {
    log.push(url);
    const ok = !missing.some((m) => url.endsWith(m));
    return {
      ok,
      status: ok ? 200 : 404,
      json: async () => ({}),
      arrayBuffer: async () => new ArrayBuffer(100),
    };
  };

describe('Sampler', () => {
  test('P1: Sampler.loadKit decodes every sample and reports monotonic progress to totalBytes', async () => {
    const ctx = new FakeAudioContext();
    const log: string[] = [];
    const sampler = new Sampler(ctx, sampleFetch([], log));
    const progress: number[] = [];
    const manifest = testManifest();
    const kit = await sampler.loadKit(manifest, '/kits/test-kit/', (p) => {
      expect(p.total).toBe(manifest.totalBytes);
      progress.push(p.loaded);
    });

    expect(log).toHaveLength(6);
    expect(log[0]).toMatch(/^\/kits\/test-kit\//);
    expect(ctx.decoded).toHaveLength(6);
    expect([...kit.buffers.keys()].sort()).toEqual(
      ['hh_closed.wav', 'hh_open.wav', 'kick_v1.wav', 'kick_v2.wav', 'snare_rr1.wav', 'snare_rr2.wav'].sort(),
    );
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(manifest.totalBytes);
    for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]!);
    expect(kit.unavailable.size).toBe(0);
  });

  test('marks articulations unavailable when a sample fails to fetch or decode', async () => {
    const ctx = new FakeAudioContext();
    ctx.decodeImpl = async () => {
      throw new Error('decode');
    };
    const broken = new Sampler(ctx, sampleFetch());
    const allBad = await broken.loadKit(testManifest(), '/k/');
    expect(allBad.unavailable.size).toBe(4);

    const sampler = new Sampler(new FakeAudioContext(), sampleFetch(['snare_rr2.wav']));
    const kit = await sampler.loadKit(testManifest(), '/k/');
    expect([...kit.unavailable]).toEqual(['snare.center']);
  });

  test('keeps the two most recently used kits resident and serves cached kits instantly', async () => {
    const log: string[] = [];
    const sampler = new Sampler(new FakeAudioContext(), sampleFetch([], log));
    const a = testManifest({ id: 'a' });
    await sampler.loadKit(a, '/k/a/');
    await sampler.loadKit(testManifest({ id: 'b' }), '/k/b/');
    const before = log.length;
    const progress: number[] = [];
    await sampler.loadKit(a, '/k/a/', (p) => progress.push(p.loaded));
    expect(log.length).toBe(before);
    expect(progress).toEqual([a.totalBytes]);
    await sampler.loadKit(testManifest({ id: 'c' }), '/k/c/');
    expect(sampler.residentKitIds).toEqual(['a', 'c']);
  });
});
