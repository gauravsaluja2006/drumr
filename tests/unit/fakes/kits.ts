import type { KitManifest } from '@/kits/schema';
import type { LoadedKit } from '@/engine/Sampler';
import { FakeBuffer } from './FakeAudioContext';

export function testManifest(overrides: Partial<KitManifest> = {}): KitManifest {
  return {
    schemaVersion: 1,
    id: 'test-kit',
    name: 'Test Kit',
    description: 'Synthetic kit for tests',
    license: { name: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    attribution: { author: 'Drumr tests', url: 'https://example.com/' },
    sampleRate: 44100,
    format: 'wav',
    totalBytes: 600,
    groups: ['kick', 'snare', 'hihat'],
    articulations: [
      {
        id: 'kick',
        group: 'kick',
        gainDb: 0,
        layers: [
          { lovel: 1, hivel: 63, samples: ['kick_v1.wav'] },
          { lovel: 64, hivel: 127, samples: ['kick_v2.wav'] },
        ],
      },
      {
        id: 'snare.center',
        group: 'snare',
        gainDb: -6,
        layers: [{ lovel: 1, hivel: 127, samples: ['snare_rr1.wav', 'snare_rr2.wav'] }],
      },
      {
        id: 'hihat.closed',
        group: 'hihat',
        chokeGroup: 'hihat',
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['hh_closed.wav'] }],
      },
      {
        id: 'hihat.open',
        group: 'hihat',
        chokeGroup: 'hihat',
        chokedBy: ['hihat.closed'],
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['hh_open.wav'] }],
      },
    ],
    hihat: { openness: ['hihat.closed', 'hihat.open'] },
    ...overrides,
  };
}

/** A LoadedKit with fake buffers tagged by sample path. */
export function loadedTestKit(manifest = testManifest()): LoadedKit {
  const paths = manifest.articulations.flatMap((a) => a.layers.flatMap((l) => l.samples));
  return {
    manifest,
    buffers: new Map(paths.map((p) => [p, new FakeBuffer(0.5, p)])),
    articulations: new Map(manifest.articulations.map((a) => [a.id, a])),
    unavailable: new Set(),
  };
}
