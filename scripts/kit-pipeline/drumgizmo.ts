/**
 * DrumGizmo kit importer (https://drumgizmo.org). A kit XML lists instruments and, per instrument,
 * which microphone channels are "main". Each instrument XML lists hits with a `power` (loudness) and
 * one multichannel WAV per hit. We pick hits by power into velocity layers and mix the main mics
 * to stereo with an ffmpeg `pan` filter.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { decode, peak } from './audio';

export interface DgInstrument {
  name: string;
  file: string; // instrument XML, relative to the kit XML's folder
  main: Set<string> | null; // null: no main markers, use every microphone channel
}

export interface DgHit {
  name: string;
  power: number | null;
  file: string; // WAV path relative to the kit root
  channels: { name: string; index: number }[]; // 0-based channel index in the WAV
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

export function parseKit(kitXmlPath: string): Map<string, DgInstrument> {
  const xml = readFileSync(kitXmlPath, 'utf8');
  const out = new Map<string, DgInstrument>();
  for (const m of xml.matchAll(/<instrument\b([^>]*?)(\/>|>([\s\S]*?)<\/instrument>)/g)) {
    const head = m[1] ?? '';
    const name = attr(head, 'name');
    const file = attr(head, 'file');
    if (!name || !file) continue;
    const body = m[3] ?? '';
    const main = [...body.matchAll(/<channelmap\b[^>]*>/g)]
      .filter((c) => attr(c[0], 'main') === 'true')
      .map((c) => attr(c[0], 'in') ?? '');
    out.set(name, { name, file, main: main.length ? new Set(main) : null });
  }
  return out;
}

const TRIGGER = /trigger/i;

export function parseInstrument(
  instrumentXmlPath: string,
  kitRoot: string,
  main: Set<string> | null,
): DgHit[] {
  const xml = readFileSync(instrumentXmlPath, 'utf8');
  const base = dirname(instrumentXmlPath);
  const hits: DgHit[] = [];
  for (const m of xml.matchAll(/<sample\b([^>]*)>([\s\S]*?)<\/sample>/g)) {
    const head = m[1] ?? '';
    const files = [...(m[2] ?? '').matchAll(/<audiofile\b[^>]*>/g)].map((a) => ({
      channel: attr(a[0], 'channel') ?? '',
      file: attr(a[0], 'file') ?? '',
      index: Number(attr(a[0], 'filechannel') ?? '1') - 1,
    }));
    const wav = files[0]?.file;
    if (!wav) continue;
    const channels = files
      .filter((f) => !TRIGGER.test(f.channel) && (!main || main.has(f.channel)))
      .map((f) => ({ name: f.channel, index: f.index }));
    const power = attr(head, 'power');
    hits.push({
      name: attr(head, 'name') ?? wav,
      power: power === undefined ? null : Number(power),
      file: relative(kitRoot, join(base, wav)).split('\\').join('/'),
      channels,
    });
  }
  return hits;
}

/** Stereo placement by microphone name: room/overhead/ambience/ride pairs are panned, others centred. */
export function panFor(channel: string): 'L' | 'R' | 'C' {
  const m = /^(amb|oh|over|room|ride)[\s_-]?(l|r|left|right)$/i.exec(channel);
  if (!m) return 'C';
  return m[2]!.toLowerCase().startsWith('l') ? 'L' : 'R';
}

/** ffmpeg filter mixing the hit's chosen channels to stereo. Centre channels go to both sides at −3 dB. */
export function panFilter(channels: DgHit['channels'], gains: Record<string, number> = {}): string {
  const left: string[] = [];
  const right: string[] = [];
  for (const c of channels) {
    const g = gains[c.name] ?? 1;
    const side = panFor(c.name);
    if (side !== 'R') left.push(`${(side === 'C' ? g * 0.7071 : g).toFixed(4)}*c${c.index}`);
    if (side !== 'L') right.push(`${(side === 'C' ? g * 0.7071 : g).toFixed(4)}*c${c.index}`);
  }
  return `pan=stereo|c0=${left.join('+') || '0*c0'}|c1=${right.join('+') || '0*c0'}`;
}

/**
 * Splits hits into velocity layers by loudness and picks round robins within each layer.
 * Hits without a `power` value are measured (peak of the stereo mix).
 */
export function selectHits(
  hits: DgHit[],
  kitRoot: string,
  maxLayers: number,
  maxRoundRobins: number,
): DgHit[][] {
  const measured = hits.map((h) => ({
    hit: h,
    power: h.power ?? peak(decode(join(kitRoot, h.file), 44100, 2, panFilter(h.channels))),
  }));
  measured.sort((a, b) => a.power - b.power);
  const layers = Math.min(maxLayers, measured.length);
  return Array.from({ length: layers }, (_, i) => {
    const group = measured.slice(
      Math.floor((i * measured.length) / layers),
      Math.floor(((i + 1) * measured.length) / layers),
    );
    // Round robins: evenly spread across the group so they differ but stay near the layer's level.
    const picks = Math.min(maxRoundRobins, group.length);
    return Array.from(
      { length: picks },
      (_, k) => group[Math.floor(((k + 0.5) * group.length) / picks)]!.hit,
    );
  });
}
