import { execFileSync, spawnSync } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

export const FFMPEG = process.env.FFMPEG_PATH ?? (ffmpegStatic as unknown as string);

export interface Pcm {
  channels: number;
  sampleRate: number;
  /** Interleaved float32 frames. */
  data: Float32Array;
}

/**
 * Decodes any audio file to interleaved float32 at the given rate/channels. An optional ffmpeg
 * filter runs first (e.g. a `pan` mixdown of a multichannel recording).
 */
export function decode(file: string, sampleRate: number, channels: number, filter?: string): Pcm {
  const resample = 'aresample=filter_size=64:phase_shift=10:cutoff=0.97';
  const out = execFileSync(
    FFMPEG,
    [
      '-v',
      'error',
      '-i',
      file,
      '-af',
      filter ? `${filter},${resample}` : resample,
      '-ac',
      String(channels),
      '-ar',
      String(sampleRate),
      '-f',
      'f32le',
      '-',
    ],
    { maxBuffer: 1 << 30 },
  );
  return { channels, sampleRate, data: new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4) };
}

/** Sums several PCM buffers frame-aligned with per-source linear gains (for multi-mic mixes). */
export function mix(parts: readonly { pcm: Pcm; gain: number }[]): Pcm {
  const first = parts[0];
  if (!first) throw new Error('mix needs at least one part');
  const length = Math.max(...parts.map((p) => p.pcm.data.length));
  const data = new Float32Array(length);
  for (const { pcm, gain } of parts)
    for (let i = 0; i < pcm.data.length; i++) data[i]! += (pcm.data[i] as number) * gain;
  return { channels: first.pcm.channels, sampleRate: first.pcm.sampleRate, data };
}

/** Channel count of a file, read from ffmpeg's stream description. */
export function fileChannels(file: string): number {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Audio: [^\n]*?, \d+ Hz, (mono|stereo|(\d+) channels)/.exec(r.stderr);
  if (!m) throw new Error(`cannot read channel layout of ${file}`);
  return m[1] === 'mono' ? 1 : m[1] === 'stereo' ? 2 : Number(m[2]);
}

/** Decodes a file at its native channel count (no up/down-mixing, which changes levels). */
export function decodeNative(file: string, sampleRate: number): Pcm {
  return decode(file, sampleRate, fileChannels(file));
}

/** Absolute peak of a file in its native channel layout (no up/down-mixing, which changes levels). */
export function filePeak(file: string): number {
  const out = execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return peak({
    channels: 1,
    sampleRate: 0,
    data: new Float32Array(out.buffer, out.byteOffset, out.byteLength / 4),
  });
}

export function peak(pcm: Pcm): number {
  let p = 0;
  for (const v of pcm.data) p = Math.max(p, Math.abs(v));
  return p;
}

export const dbToLinear = (db: number) => Math.pow(10, db / 20);
export const linearToDb = (g: number) => (g <= 0 ? -Infinity : 20 * Math.log10(g));

/** First frame whose absolute value on any channel reaches `threshold`; -1 if none. */
export function firstFrameAbove(pcm: Pcm, threshold: number): number {
  for (let i = 0; i < pcm.data.length; i++)
    if (Math.abs(pcm.data[i] as number) >= threshold) return Math.floor(i / pcm.channels);
  return -1;
}

export function lastFrameAbove(pcm: Pcm, threshold: number): number {
  for (let i = pcm.data.length - 1; i >= 0; i--)
    if (Math.abs(pcm.data[i] as number) >= threshold) return Math.floor(i / pcm.channels);
  return -1;
}

export interface TrimOptions {
  startThreshold: number; // linear
  endThreshold: number; // linear
  maxSeconds: number;
  fadeOutMs: number;
  /** Frames kept before the first transient. Default 1 ms. */
  preRollMs?: number;
}

/**
 * Removes leading silence without cutting the transient (keeps `preRollMs` before the first frame
 * above threshold), cuts the tail at the last frame above `endThreshold` or `maxSeconds`, and fades out.
 */
export function trim(pcm: Pcm, o: TrimOptions): Pcm {
  const ch = pcm.channels;
  const frames = pcm.data.length / ch;
  const first = firstFrameAbove(pcm, o.startThreshold);
  if (first < 0) return { ...pcm, data: new Float32Array(0) };
  const start = Math.max(0, first - Math.round(((o.preRollMs ?? 1) / 1000) * pcm.sampleRate));
  const lastLoud = lastFrameAbove(pcm, o.endThreshold);
  const end = Math.min(frames, lastLoud + 1, start + Math.round(o.maxSeconds * pcm.sampleRate));
  const data = pcm.data.slice(start * ch, end * ch);
  const fadeFrames = Math.min(Math.round((o.fadeOutMs / 1000) * pcm.sampleRate), end - start);
  const outFrames = end - start;
  for (let f = 0; f < fadeFrames; f++) {
    const frame = outFrames - fadeFrames + f;
    const g = 1 - (f + 1) / fadeFrames;
    for (let c = 0; c < ch; c++) data[frame * ch + c]! *= g;
  }
  return { ...pcm, data };
}

export function scale(pcm: Pcm, gain: number): Pcm {
  return { ...pcm, data: pcm.data.map((v) => v * gain) };
}

/** Encodes to 16-bit FLAC (triangular dither) or WAV, depending on the extension. */
export function encode(pcm: Pcm, file: string): void {
  const input = Buffer.from(pcm.data.buffer, pcm.data.byteOffset, pcm.data.byteLength);
  const codec = file.endsWith('.flac') ? ['-c:a', 'flac', '-compression_level', '8'] : ['-c:a', 'pcm_s16le'];
  execFileSync(
    FFMPEG,
    [
      '-v',
      'error',
      '-y',
      '-f',
      'f32le',
      '-ac',
      String(pcm.channels),
      '-ar',
      String(pcm.sampleRate),
      '-i',
      '-',
      '-af',
      'aresample=osf=s16:dither_method=triangular',
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      ...codec,
      file,
    ],
    { input, maxBuffer: 1 << 30 },
  );
}
