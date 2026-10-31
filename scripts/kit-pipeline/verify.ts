import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { firstIssue, kitManifestSchema } from '../../src/kits/schema';
import { dbToLinear, decodeNative, filePeak, firstFrameAbove, linearToDb } from './audio';

export interface VerifyOptions {
  maxBytes: number;
  reference?: string;
  targetPeakDbfs?: number;
  toleranceDb?: number;
  maxLeadingMs?: number;
  startThresholdDb?: number;
  /** Skip decoding audio (structure checks only). */
  structureOnly?: boolean;
}

export interface VerifyResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  totalBytes: number;
  sampleCount: number;
  referencePeakDbfs?: number;
}

export function verifyKit(kitDir: string, o: VerifyOptions): VerifyResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = JSON.parse(readFileSync(join(kitDir, 'manifest.json'), 'utf8')) as unknown;
  const parsed = kitManifestSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors.push(`schema: ${issue.path.join('.')}: ${issue.message}`);
    return { ok: false, errors, warnings, totalBytes: 0, sampleCount: 0 };
  }
  const m = parsed.data;
  const samples = [...new Set(m.articulations.flatMap((a) => a.layers.flatMap((l) => l.samples)))];
  let totalBytes = 0;
  for (const s of samples) {
    const p = join(kitDir, s);
    if (!existsSync(p)) errors.push(`missing file: ${s}`);
    else totalBytes += statSync(p).size;
  }
  if (totalBytes > o.maxBytes) errors.push(`over budget: ${totalBytes} bytes > ${o.maxBytes}`);
  if (totalBytes !== m.totalBytes)
    warnings.push(`manifest totalBytes ${m.totalBytes} ≠ actual ${totalBytes}`);

  let referencePeakDbfs: number | undefined;
  if (!o.structureOnly && errors.length === 0) {
    const threshold = dbToLinear(o.startThresholdDb ?? -50);
    const maxLead = Math.round(((o.maxLeadingMs ?? 2) / 1000) * m.sampleRate);
    for (const s of samples) {
      const pcm = decodeNative(join(kitDir, s), m.sampleRate);
      const first = firstFrameAbove(pcm, threshold);
      if (first > maxLead)
        errors.push(`leading silence ${((first / m.sampleRate) * 1000).toFixed(1)} ms in ${s}`);
    }
    const ref = o.reference ? m.articulations.find((a) => a.id === o.reference) : undefined;
    if (o.reference && !ref) errors.push(`reference articulation "${o.reference}" not in kit`);
    if (ref && o.targetPeakDbfs !== undefined) {
      const top = ref.layers.at(-1)!;
      referencePeakDbfs = linearToDb(Math.max(...top.samples.map((s) => filePeak(join(kitDir, s)))));
      const diff = referencePeakDbfs - o.targetPeakDbfs;
      if (Math.abs(diff) > (o.toleranceDb ?? 1)) {
        (diff < 0 ? warnings : errors).push(
          `reference peak ${referencePeakDbfs.toFixed(2)} dBFS vs target ${o.targetPeakDbfs}`,
        );
      }
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    totalBytes,
    sampleCount: samples.length,
    ...(referencePeakDbfs !== undefined ? { referencePeakDbfs } : {}),
  };
}

export { firstIssue };
