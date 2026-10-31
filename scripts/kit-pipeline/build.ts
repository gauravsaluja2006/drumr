import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { kitManifestSchema, type KitManifest } from '../../src/kits/schema';
import type { Recipe, RecipeArticulation } from './recipe';
import { discover, listFiles, selectLayers, velocityRanges, type Discovered } from './discover';
import { dbToLinear, decode, encode, linearToDb, mix, peak, scale, trim, type Pcm } from './audio';
import { panFilter, parseInstrument, parseKit, selectHits } from './drumgizmo';

export interface BuildOptions {
  sourcesRoot: string;
  outRoot: string;
  log?: (msg: string) => void;
}

interface Job {
  art: RecipeArticulation;
  layer: number; // 0-based kept layer index
  rr: number; // 0-based
  inputs: { path: string; gain: number; filter?: string }[];
  output: string; // relative to kit dir
  pcm?: Pcm;
}

export interface BuildResult {
  manifest: KitManifest;
  kitGainDb: number;
  clipGuarded: boolean;
  referencePeakDbfs: number;
}

const outName = (id: string, layer: number, rr: number) =>
  `samples/${id.replace(/[^a-z0-9]+/gi, '_')}_v${layer + 1}_rr${rr + 1}.flac`;

/** Matches a file discovered for the primary source in every other mix source by (layer, rr). */
function alignMix(primary: Discovered, others: Discovered[][]): Discovered[] | null {
  const matches = others.map((list) => list.find((d) => d.layer === primary.layer && d.rr === primary.rr));
  return matches.every(Boolean) ? (matches as Discovered[]) : null;
}

function planDrumgizmoJobs(recipe: Recipe, libRoot: string): Job[] {
  const dg = recipe.drumgizmo!;
  const kitXml = join(libRoot, dg.kit);
  const kitDir = dirname(kitXml);
  const instruments = parseKit(kitXml);
  return recipe.articulations.flatMap((art) => {
    const inst = instruments.get(art.instrument!);
    if (!inst) throw new Error(`${art.id}: DrumGizmo instrument "${art.instrument}" not in ${dg.kit}`);
    const hits = parseInstrument(join(kitDir, inst.file), libRoot, inst.main);
    if (hits.length === 0) throw new Error(`${art.id}: instrument "${art.instrument}" has no samples`);
    const layers = selectHits(
      hits,
      libRoot,
      art.maxVelocityLayers ?? recipe.budget.maxVelocityLayers,
      recipe.budget.maxRoundRobins,
    );
    if (art.ranges && art.ranges.length !== layers.length)
      throw new Error(`${art.id}: ${art.ranges.length} ranges for ${layers.length} layers`);
    return layers.flatMap((rrs, layer) =>
      rrs.map((hit, rr) => ({
        art,
        layer,
        rr,
        inputs: [{ path: hit.file, gain: 1, filter: panFilter(hit.channels, dg.micGains) }],
        output: outName(art.id, layer, rr),
      })),
    );
  });
}

export function planJobs(recipe: Recipe, files: readonly string[], libRoot = ''): Job[] {
  if (recipe.drumgizmo) return planDrumgizmoJobs(recipe, libRoot);
  const available = new Set(files);
  return recipe.articulations.flatMap((art) => {
    if (art.layerFiles) {
      if (art.ranges && art.ranges.length !== art.layerFiles.length) {
        throw new Error(`${art.id}: ${art.ranges.length} ranges for ${art.layerFiles.length} layers`);
      }
      return art.layerFiles.flatMap((rrs, layer) =>
        rrs.slice(0, recipe.budget.maxRoundRobins).map((path, rr) => {
          if (!available.has(path)) throw new Error(`${art.id}: file not found "${path}"`);
          return { art, layer, rr, inputs: [{ path, gain: 1 }], output: outName(art.id, layer, rr) };
        }),
      );
    }
    const [primarySrc, ...otherSrcs] = art.sources;
    if (!primarySrc) throw new Error(`${art.id}: no sources`);
    const primary = discover(files, primarySrc.glob);
    if (primary.length === 0) throw new Error(`${art.id}: no files match "${primarySrc.glob}"`);
    const others = otherSrcs.map((s) => discover(files, s.glob));
    const layers = selectLayers(
      primary,
      art.maxVelocityLayers ?? recipe.budget.maxVelocityLayers,
      recipe.budget.maxRoundRobins,
    );
    if (art.ranges && art.ranges.length !== layers.length) {
      throw new Error(`${art.id}: ${art.ranges.length} ranges for ${layers.length} layers`);
    }
    return layers.flatMap((rrs, layer) =>
      rrs.map((d, rr) => {
        const aligned = alignMix(d, others);
        if (!aligned) throw new Error(`${art.id}: mix sources missing a match for ${d.path}`);
        return {
          art,
          layer,
          rr,
          inputs: [
            { path: d.path, gain: dbToLinear(primarySrc.gainDb) },
            ...aligned.map((a, i) => ({ path: a.path, gain: dbToLinear(otherSrcs[i]!.gainDb) })),
          ],
          output: outName(art.id, layer, rr),
        };
      }),
    );
  });
}

const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

export function buildKit(recipe: Recipe, opts: BuildOptions): BuildResult {
  const log = opts.log ?? (() => {});
  const libRoot = join(opts.sourcesRoot, recipe.source.libraryId, recipe.source.root);
  const files = recipe.drumgizmo ? [] : listFiles(libRoot);
  const jobs = planJobs(recipe, files, libRoot);
  const { sampleRate, channels } = recipe.output;
  const t = recipe.trim;
  log(`${recipe.id}: ${jobs.length} samples from ${files.length} source files`);

  // Pass 1: decode and mix. Kept in memory to compute one kit-wide gain.
  // Hits peak near their start, so peaks measured before trimming equal the shipped peaks.
  for (const job of jobs) {
    const parts = job.inputs.map((i) => ({
      pcm: decode(join(libRoot, i.path), sampleRate, channels, i.filter),
      gain: i.gain,
    }));
    job.pcm = mix(parts);
  }

  const refJobs = jobs.filter((j) => j.art.id === recipe.normalize.reference);
  if (refJobs.length === 0)
    throw new Error(`normalize.reference "${recipe.normalize.reference}" is not an articulation`);
  const topLayer = Math.max(...refJobs.map((j) => j.layer));
  const refPeak = Math.max(...refJobs.filter((j) => j.layer === topLayer).map((j) => peak(j.pcm!)));
  const allPeak = Math.max(...jobs.map((j) => peak(j.pcm!)));
  let gain = dbToLinear(recipe.normalize.targetPeakDbfs) / refPeak;
  const clipGuarded = allPeak * gain > 0.98;
  if (clipGuarded) {
    gain = 0.98 / allPeak;
    log(
      `${recipe.id}: clip guard lowered kit gain; reference peak will be ${linearToDb(refPeak * gain).toFixed(1)} dBFS`,
    );
  }

  // Pass 2: apply gain, then trim (so thresholds apply to the audio that ships), then encode.
  const kitDir = join(opts.outRoot, recipe.id);
  rmSync(kitDir, { recursive: true, force: true });
  mkdirSync(join(kitDir, 'samples'), { recursive: true });
  let totalBytes = 0;
  for (const job of jobs) {
    const shipped = trim(scale(job.pcm!, gain), {
      startThreshold: dbToLinear(t.startThresholdDb),
      endThreshold: dbToLinear(t.endThresholdDb),
      maxSeconds: t.maxSeconds[job.art.group] ?? t.maxSeconds.default ?? 2.5,
      fadeOutMs: t.fadeOutMs,
    });
    encode(shipped, join(kitDir, job.output));
    totalBytes += statSync(join(kitDir, job.output)).size;
    job.pcm = undefined;
  }

  const articulations = recipe.articulations.map((art) => {
    const mine = jobs.filter((j) => j.art === art);
    const layerCount = Math.max(...mine.map((j) => j.layer)) + 1;
    const ranges = art.ranges ?? velocityRanges(layerCount);
    return {
      id: art.id,
      group: art.group,
      ...(art.chokeGroup ? { chokeGroup: art.chokeGroup } : {}),
      ...(art.chokedBy ? { chokedBy: art.chokedBy } : {}),
      gainDb: art.gainDb,
      layers: ranges.map(([lovel, hivel], layer) => ({
        lovel,
        hivel,
        samples: mine.filter((j) => j.layer === layer).map((j) => j.output),
      })),
    };
  });

  const manifest = kitManifestSchema.parse({
    schemaVersion: 1,
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    license: recipe.license,
    attribution: recipe.attribution,
    sampleRate,
    format: 'flac',
    totalBytes,
    groups: [...new Set(recipe.articulations.map((a) => a.group))],
    articulations,
    ...(recipe.hihat ? { hihat: recipe.hihat } : {}),
  });
  writeFileSync(join(kitDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(
    join(kitDir, 'provenance.json'),
    JSON.stringify(
      {
        recipe: recipe.id,
        kitGainDb: Number(linearToDb(gain).toFixed(2)),
        samples: jobs.map((j) => ({
          output: j.output,
          sources: j.inputs.map((i) => ({ path: i.path, sha256: sha256(join(libRoot, i.path)) })),
        })),
      },
      null,
      2,
    ) + '\n',
  );
  if (recipe.licenseText) writeFileSync(join(kitDir, 'LICENSE.txt'), recipe.licenseText.trim() + '\n');

  return {
    manifest,
    kitGainDb: linearToDb(gain),
    clipGuarded,
    referencePeakDbfs: linearToDb(refPeak * gain),
  };
}
