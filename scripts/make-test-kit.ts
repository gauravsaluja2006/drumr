/**
 * Generates tiny synthetic kits for tests and local development (docs/05-TESTING.md §3.3).
 * Output: tests/fixtures/kits/{index.json, test-kit/, test-kit-b/}. Deterministic.
 * Usage: pnpm make:test-kit [--public]   (--public also copies into public/kits/ for the Phase 1 demo)
 */
import { cpSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { KitManifest } from '../src/kits/schema';
import { kitManifestSchema } from '../src/kits/schema';
import { wav } from './lib/wav';

const SR = 44100;
const root = new URL('..', import.meta.url).pathname;
const outRoot = join(root, 'tests/fixtures/kits');

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

function render(seconds: number, fn: (t: number, i: number) => number): Float32Array {
  const n = Math.round(seconds * SR);
  return Float32Array.from({ length: n }, (_, i) => fn(i / SR, i));
}

const tone = (freq: number, seconds: number, amp: number, decay: number) =>
  render(seconds, (t) => Math.sin(2 * Math.PI * freq * t) * amp * Math.exp(-t / decay));

const noise = (seconds: number, amp: number, decay: number, seed: number) => {
  const r = seeded(seed);
  return render(seconds, (t) => r() * amp * Math.exp(-t / decay));
};

/** High-passed noise for hats: noise minus a one-pole low-pass of itself. */
const hat = (seconds: number, amp: number, decay: number, seed: number) => {
  const r = seeded(seed);
  let lp = 0;
  return render(seconds, (t) => {
    const x = r();
    lp += 0.2 * (x - lp);
    return (x - lp) * amp * Math.exp(-t / decay);
  });
};

interface KitSpec {
  id: string;
  name: string;
  description: string;
  files: Record<string, Float32Array>;
  articulations: KitManifest['articulations'];
  groups: KitManifest['groups'];
  hihat?: KitManifest['hihat'];
}

const kits: KitSpec[] = [
  {
    id: 'test-kit',
    name: 'Test Kit',
    description: 'Synthetic tones for tests and development. Not a real drum kit.',
    groups: ['kick', 'snare', 'hihat'],
    files: {
      'samples/kick_v1.wav': tone(100, 0.05, 0.4, 0.03),
      'samples/kick_v2.wav': tone(100, 0.05, 0.9, 0.03),
      'samples/snare_rr1.wav': noise(0.05, 0.7, 0.02, 11),
      'samples/snare_rr2.wav': noise(0.05, 0.7, 0.02, 23),
      'samples/hh_closed.wav': hat(0.03, 0.5, 0.008, 5),
      // 2 s so it is still ringing through slow kit switches and choke tests on CI.
      'samples/hh_open.wav': render(2, (t) => Math.sin(2 * Math.PI * 8000 * t) * 0.4 * Math.exp(-t / 0.6)),
    },
    articulations: [
      {
        id: 'kick',
        group: 'kick',
        gainDb: 0,
        layers: [
          { lovel: 1, hivel: 63, samples: ['samples/kick_v1.wav'] },
          { lovel: 64, hivel: 127, samples: ['samples/kick_v2.wav'] },
        ],
      },
      {
        id: 'snare.center',
        group: 'snare',
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['samples/snare_rr1.wav', 'samples/snare_rr2.wav'] }],
      },
      {
        id: 'hihat.closed',
        group: 'hihat',
        chokeGroup: 'hihat',
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['samples/hh_closed.wav'] }],
      },
      {
        id: 'hihat.open',
        group: 'hihat',
        chokeGroup: 'hihat',
        chokedBy: ['hihat.closed'],
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['samples/hh_open.wav'] }],
      },
    ],
    hihat: { openness: ['hihat.closed', 'hihat.open'] },
  },
  {
    id: 'test-kit-b',
    name: 'Test Kit B',
    description: 'Second synthetic kit for kit-switching tests. Has toms, no hi-hat.',
    groups: ['kick', 'snare', 'toms'],
    files: {
      'samples/kick.wav': tone(60, 0.06, 0.8, 0.04),
      'samples/snare.wav': noise(0.06, 0.6, 0.03, 31),
      'samples/tom_high.wav': tone(220, 0.08, 0.6, 0.05),
      'samples/tom_low.wav': tone(110, 0.08, 0.6, 0.05),
    },
    articulations: [
      {
        id: 'kick',
        group: 'kick',
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['samples/kick.wav'] }],
      },
      {
        id: 'snare.center',
        group: 'snare',
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['samples/snare.wav'] }],
      },
      {
        id: 'tom.high',
        group: 'toms',
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['samples/tom_high.wav'] }],
      },
      {
        id: 'tom.low',
        group: 'toms',
        gainDb: 0,
        layers: [{ lovel: 1, hivel: 127, samples: ['samples/tom_low.wav'] }],
      },
    ],
  },
];

rmSync(outRoot, { recursive: true, force: true });
const index = kits.map((k) => {
  const dir = join(outRoot, k.id);
  mkdirSync(join(dir, 'samples'), { recursive: true });
  let totalBytes = 0;
  for (const [path, samples] of Object.entries(k.files)) {
    writeFileSync(join(dir, path), wav(samples));
    totalBytes += statSync(join(dir, path)).size;
  }
  const manifest: KitManifest = kitManifestSchema.parse({
    schemaVersion: 1,
    id: k.id,
    name: k.name,
    description: k.description,
    license: { name: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    attribution: { author: 'Drumr (generated)', url: 'https://github.com/gauravsaluja2006/drumr' },
    sampleRate: SR,
    format: 'wav',
    totalBytes,
    groups: k.groups,
    articulations: k.articulations,
    ...(k.hihat ? { hihat: k.hihat } : {}),
  });
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { id: k.id, name: k.name, description: k.description, totalBytes };
});
writeFileSync(join(outRoot, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`Wrote ${index.length} kits to ${outRoot}`);

if (process.argv.includes('--public')) {
  const pub = join(root, 'public/kits');
  rmSync(pub, { recursive: true, force: true });
  cpSync(outRoot, pub, { recursive: true });
  console.log(`Copied to ${pub}`);
}
