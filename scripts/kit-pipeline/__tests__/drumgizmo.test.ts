import { beforeAll, describe, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { panFilter, panFor, parseInstrument, parseKit, selectHits } from '../drumgizmo';
import { buildKit } from '../build';
import { recipeSchema } from '../recipe';
import { decode, filePeak, linearToDb } from '../audio';
import { wav } from '../../lib/wav';
import { kitManifestSchema } from '../../../src/kits/schema';

const SR = 44100;
let root: string;
let lib: string;

/** 4-channel hit: ch0 close mic (loud), ch1 OHL, ch2 OHR, ch3 trigger (huge spike, must be ignored). */
function hit(amp: number): Float32Array {
  const frames = Math.round(0.2 * SR);
  const out = new Float32Array(frames * 4);
  for (let i = 0; i < frames; i++) {
    const s = Math.sin((2 * Math.PI * 180 * i) / SR) * Math.exp(-i / (0.04 * SR));
    out[i * 4] = amp * s;
    out[i * 4 + 1] = amp * 0.5 * s;
    out[i * 4 + 2] = amp * 0.25 * s;
    out[i * 4 + 3] = i < 10 ? 1 : 0;
  }
  return out;
}

const kitXml = (main: boolean) => `<?xml version="1.0"?>
<drumkit name="t">
  <instruments>
    <instrument name="Snare" file="Snare/Snare.xml">
      <channelmap in="Close" out="Close"${main ? ' main="true"' : ''}/>
      <channelmap in="OHL" out="OHL"${main ? ' main="true"' : ''}/>
      <channelmap in="OHR" out="OHR"/>
      <channelmap in="Trigger" out="Trigger"/>
    </instrument>
    <instrument name="Kick" file="Kick/Kick.xml"/>
  </instruments>
</drumkit>`;

const instrumentXml = (amps: number[], powerAttr: boolean) => `<?xml version="1.0"?>
<instrument version="2.0" name="Snare"><samples>
${amps
  .map(
    (a, i) => `<sample name="s${i}"${powerAttr ? ` power="${a}"` : ''}>
  <audiofile channel="Close" file="samples/${i}.wav" filechannel="1"/>
  <audiofile channel="OHL" file="samples/${i}.wav" filechannel="2"/>
  <audiofile channel="OHR" file="samples/${i}.wav" filechannel="3"/>
  <audiofile channel="Trigger" file="samples/${i}.wav" filechannel="4"/>
</sample>`,
  )
  .join('\n')}
</samples></instrument>`;

const AMPS = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8];

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'drumr-dg-'));
  lib = join(root, 'sources', 'dglib', 'Kit');
  mkdirSync(join(lib, 'Snare', 'samples'), { recursive: true });
  AMPS.forEach((a, i) => writeFileSync(join(lib, 'Snare', 'samples', `${i}.wav`), wav(hit(a), SR, 4)));
  // Shuffled order in the XML: selection must sort by power, not file order.
  writeFileSync(
    join(lib, 'Snare', 'Snare.xml'),
    instrumentXml([...AMPS].reverse(), true).replace(
      /samples\/(\d)\.wav/g,
      (_m, d) => `samples/${AMPS.length - 1 - Number(d)}.wav`,
    ),
  );
  writeFileSync(join(lib, 'kit.xml'), kitXml(true));
  writeFileSync(join(lib, 'kit-nomain.xml'), kitXml(false));
  return () => rmSync(root, { recursive: true, force: true });
});

describe('DrumGizmo importer', () => {
  test('parses instruments, main microphones and hits; drops trigger channels', () => {
    const kit = parseKit(join(lib, 'kit.xml'));
    expect([...kit.keys()]).toEqual(['Snare', 'Kick']);
    expect([...kit.get('Snare')!.main!]).toEqual(['Close', 'OHL']);
    expect(kit.get('Kick')!.main).toBeNull(); // self-closing, no channelmap
    expect(parseKit(join(lib, 'kit-nomain.xml')).get('Snare')!.main).toBeNull();

    const hits = parseInstrument(join(lib, 'Snare', 'Snare.xml'), lib, null);
    expect(hits).toHaveLength(8);
    expect(hits[0]).toMatchObject({ name: 's0', power: 0.8, file: 'Snare/samples/7.wav' });
    expect(hits[0]!.channels.map((c) => c.name)).toEqual(['Close', 'OHL', 'OHR']); // Trigger dropped
    const mainOnly = parseInstrument(join(lib, 'Snare', 'Snare.xml'), lib, new Set(['Close']));
    expect(mainOnly[0]!.channels).toEqual([{ name: 'Close', index: 0 }]);
  });

  test('pans room/overhead/ambience pairs and centres everything else', () => {
    expect(
      ['OHL', 'OH-R', 'AmbL', 'Room-L', 'RideR', 'Overheads', 'KdrumL', 'Snare_top', 'OH Left'].map(panFor),
    ).toEqual(['L', 'R', 'L', 'L', 'R', 'C', 'C', 'C', 'L']);
    expect(
      panFilter(
        [
          { name: 'Close', index: 0 },
          { name: 'OHL', index: 1 },
          { name: 'OHR', index: 2 },
        ],
        { OHR: 0.5 },
      ),
    ).toBe('pan=stereo|c0=0.7071*c0+1.0000*c1|c1=0.7071*c0+0.5000*c2');
    expect(panFilter([])).toBe('pan=stereo|c0=0*c0|c1=0*c0');
  });

  test('selects velocity layers by power (measured when absent) and spreads round robins', () => {
    const withPower = parseInstrument(join(lib, 'Snare', 'Snare.xml'), lib, null);
    const layers = selectHits(withPower, lib, 4, 1);
    expect(layers.map((l) => l.map((h) => h.power))).toEqual([[0.1], [0.3], [0.5], [0.8]]);
    const noPower = withPower.map((h) => ({ ...h, power: null }));
    const measured = selectHits(noPower, lib, 2, 2);
    // 8 hits measured quietest→loudest, 2 layers of 4; round robins at evenly spread positions 1 and 3.
    expect(measured.flat().map((h) => h.file)).toEqual([
      'Snare/samples/1.wav',
      'Snare/samples/3.wav',
      'Snare/samples/5.wav',
      'Snare/samples/7.wav',
    ]);
  });

  test('builds a stereo kit from multichannel hits through the normal pipeline', () => {
    const recipe = recipeSchema.parse({
      id: 'dg-test',
      name: 'DG test',
      description: 'x',
      local: true,
      license: { name: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      attribution: { author: 't', url: 'https://example.com/' },
      source: { libraryId: 'dglib', root: 'Kit' },
      drumgizmo: { kit: 'kit.xml' },
      budget: { maxVelocityLayers: 3, maxRoundRobins: 2 },
      articulations: [{ id: 'snare.center', group: 'snare', instrument: 'Snare' }],
    });
    expect(recipe.local).toBe(true);
    const out = join(root, 'out');
    const res = buildKit(recipe, { sourcesRoot: join(root, 'sources'), outRoot: out });
    expect(res.referencePeakDbfs).toBeCloseTo(-6, 1);
    const manifest = kitManifestSchema.parse(
      JSON.parse(readFileSync(join(out, 'dg-test', 'manifest.json'), 'utf8')),
    );
    const layers = manifest.articulations[0]!.layers;
    expect(layers.map((l) => l.samples.length)).toEqual([2, 2, 2]);
    const top = join(out, 'dg-test', layers[2]!.samples[0]!);
    const pcm = decode(top, SR, 2);
    expect(pcm.channels).toBe(2);
    // Main mics only (Close centred, OHL left): left louder than right; trigger spike excluded.
    let l = 0;
    let r = 0;
    for (let i = 0; i < pcm.data.length; i += 2) {
      l = Math.max(l, Math.abs(pcm.data[i]!));
      r = Math.max(r, Math.abs(pcm.data[i + 1]!));
    }
    expect(l).toBeGreaterThan(r);
    expect(linearToDb(filePeak(top))).toBeLessThan(-5);
    expect(() =>
      buildKit(
        { ...recipe, articulations: [{ ...recipe.articulations[0]!, instrument: 'Gong' }] },
        { sourcesRoot: join(root, 'sources'), outRoot: out },
      ),
    ).toThrow(/Gong/);
  });
});
