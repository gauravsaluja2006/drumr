import type { AudioBufferLike, IAudioContext } from './audioContext';
import type { Articulation, KitManifest } from '@/kits/schema';
import { joinUrl, type FetchLike } from '@/kits/loader';

export interface LoadProgress {
  loaded: number;
  total: number;
}

export interface LoadedKit {
  manifest: KitManifest;
  buffers: ReadonlyMap<string, AudioBufferLike>;
  articulations: ReadonlyMap<string, Articulation>;
  /** Articulations with at least one sample that failed to fetch or decode. */
  unavailable: ReadonlySet<string>;
}

const CONCURRENCY = 6;
const MAX_RESIDENT_KITS = 2;

/** Loads and decodes kits; keeps the two most recently used kits resident. */
export class Sampler {
  private readonly cache = new Map<string, LoadedKit>();

  constructor(
    private readonly ctx: IAudioContext,
    private readonly fetchImpl: FetchLike,
  ) {}

  get residentKitIds(): string[] {
    return [...this.cache.keys()];
  }

  async loadKit(
    manifest: KitManifest,
    kitBaseUrl: string,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<LoadedKit> {
    const cached = this.cache.get(manifest.id);
    if (cached) {
      this.touch(manifest.id, cached);
      onProgress?.({ loaded: manifest.totalBytes, total: manifest.totalBytes });
      return cached;
    }

    const total = manifest.totalBytes;
    const paths = [...new Set(manifest.articulations.flatMap((a) => a.layers.flatMap((l) => l.samples)))];
    const buffers = new Map<string, AudioBufferLike>();
    const failed = new Set<string>();
    let loaded = 0;
    onProgress?.({ loaded: 0, total });

    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const path = paths[next++] as string;
        try {
          const res = await this.fetchImpl(joinUrl(kitBaseUrl, path));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const bytes = await res.arrayBuffer();
          loaded += bytes.byteLength;
          onProgress?.({ loaded: Math.min(loaded, total), total });
          buffers.set(path, await this.ctx.decodeAudioData(bytes));
        } catch {
          failed.add(path);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, paths.length) }, worker));
    onProgress?.({ loaded: total, total });

    const unavailable = new Set(
      manifest.articulations
        .filter((a) => a.layers.some((l) => l.samples.some((s) => failed.has(s))))
        .map((a) => a.id),
    );
    const kit: LoadedKit = {
      manifest,
      buffers,
      articulations: new Map(manifest.articulations.map((a) => [a.id, a])),
      unavailable,
    };
    this.touch(manifest.id, kit);
    return kit;
  }

  private touch(id: string, kit: LoadedKit) {
    this.cache.delete(id);
    this.cache.set(id, kit);
    while (this.cache.size > MAX_RESIDENT_KITS) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.delete(oldest);
    }
  }
}
