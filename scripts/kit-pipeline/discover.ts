import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface Discovered {
  path: string; // relative to the search root, forward slashes
  layer: number;
  rr: number;
}

/** Converts a recipe glob into a RegExp. `{layer}`/`{rr}` capture integers, `*` matches within a segment. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('{layer}', i)) {
      re += '(?<layer>\\d+)';
      i += 6;
    } else if (glob.startsWith('{rr}', i)) {
      re += '(?<rr>\\d+)';
      i += 3;
    } else if (glob[i] === '*') {
      re += '[^/]*';
    } else {
      re += (glob[i] as string).replace(/[.+?^$()|[\]\\{}]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

export function listFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(root, p).split(sep).join('/'));
    }
  };
  walk(root);
  return out;
}

/** Matches files against a glob; missing {layer}/{rr} default to 1. Sorted by layer then rr. */
export function discover(files: readonly string[], glob: string): Discovered[] {
  const re = globToRegExp(glob);
  return files
    .flatMap((path) => {
      const m = re.exec(path);
      if (!m) return [];
      return [{ path, layer: Number(m.groups?.layer ?? 1), rr: Number(m.groups?.rr ?? 1) }];
    })
    .sort((a, b) => a.layer - b.layer || a.rr - b.rr || a.path.localeCompare(b.path));
}

/** Picks `max` evenly spaced items, always keeping the first and last. */
export function subsample<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  if (max === 1) return [items[items.length - 1] as T];
  const picked: T[] = [];
  for (let k = 0; k < max; k++) picked.push(items[Math.round((k * (items.length - 1)) / (max - 1))] as T);
  return picked;
}

/** Groups discovered files into velocity layers, subsampling layers and capping round robins. */
export function selectLayers(
  found: readonly Discovered[],
  maxLayers: number,
  maxRoundRobins: number,
): Discovered[][] {
  const byLayer = new Map<number, Discovered[]>();
  for (const f of found) byLayer.set(f.layer, [...(byLayer.get(f.layer) ?? []), f]);
  const layerIds = [...byLayer.keys()].sort((a, b) => a - b);
  return subsample(layerIds, maxLayers).map((id) => (byLayer.get(id) ?? []).slice(0, maxRoundRobins));
}

/** Splits 1..127 into `n` contiguous ranges. */
export function velocityRanges(n: number): [number, number][] {
  if (n < 1) throw new RangeError('need at least one layer');
  return Array.from({ length: n }, (_, i) => [
    Math.floor((i * 127) / n) + 1,
    Math.floor(((i + 1) * 127) / n),
  ]);
}
