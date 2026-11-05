import { create } from 'zustand';
import { fetchKitIndex, fetchKitManifest } from '@/kits/loader';
import type { KitIndex, KitManifest } from '@/kits/schema';
import { getRuntime } from '@/app/runtime';
import { useSettingsStore } from './useSettingsStore';

export type KitStatus = 'idle' | 'loading' | 'ready' | 'error';

interface KitState {
  index: KitIndex;
  currentKitId: string | null;
  manifest: KitManifest | null;
  status: KitStatus;
  progress: { loaded: number; total: number };
  error: string | null;
  /** Articulation ids that can actually play in the current kit. */
  available: ReadonlySet<string>;
  /** Manifests fetched so far, by kit id (for the selector badges and the About panel). */
  manifests: Readonly<Record<string, KitManifest>>;
  init: () => Promise<void>;
  loadAllManifests: () => Promise<void>;
  switchKit: (id: string) => Promise<void>;
  /**
   * Switch synchronously to a kit that is already decoded (preloaded). Returns false when it is not
   * resident; use switchKit then. Lets loop playback change kit exactly on a pass boundary.
   */
  switchKitNow: (id: string) => boolean;
  /** Fetch and decode a kit in the background (no status or progress) so switching to it is instant. */
  preloadKit: (id: string) => Promise<void>;
}

let loadToken = 0;
/** In-flight background loads, so a switch to a kit that is still preloading waits instead of loading it twice. */
const preloading = new Map<string, Promise<void>>();

/** Folder that holds a kit's `<id>/` directory: the local-only index's base, or the main one. */
export function kitBaseUrl(index: KitIndex, id: string): string {
  return index.find((k) => k.id === id)?.baseUrl ?? getRuntime().kitsBaseUrl;
}

export const useKitStore = create<KitState>()((set, get) => ({
  index: [],
  currentKitId: null,
  manifest: null,
  status: 'idle',
  progress: { loaded: 0, total: 0 },
  error: null,
  available: new Set(),
  manifests: {},

  init: async () => {
    try {
      const { kitsBaseUrl, localKitsBaseUrl, fetch } = getRuntime();
      const main = await fetchKitIndex(kitsBaseUrl, fetch);
      // Local-only kits are optional: a missing or broken index just means there are none.
      const local = localKitsBaseUrl
        ? await fetchKitIndex(localKitsBaseUrl, fetch).catch(() => [] as KitIndex)
        : [];
      const ids = new Set(main.map((k) => k.id));
      const index = [
        ...main,
        ...local.filter((k) => !ids.has(k.id)).map((k) => ({ ...k, baseUrl: localKitsBaseUrl! })),
      ];
      set({ index });
      const remembered = useSettingsStore.getState().lastKitId;
      const first = index.find((k) => k.id === remembered) ?? index[0];
      if (!first) throw new Error('No kits available');
      await get().switchKit(first.id);
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  loadAllManifests: async () => {
    const { fetch } = getRuntime();
    const missing = get().index.filter((k) => !get().manifests[k.id]);
    const loaded = await Promise.allSettled(
      missing.map((k) => fetchKitManifest(kitBaseUrl(get().index, k.id), k.id, fetch)),
    );
    const add: Record<string, KitManifest> = {};
    for (const r of loaded) if (r.status === 'fulfilled') add[r.value.id] = r.value;
    set({ manifests: { ...get().manifests, ...add } });
  },

  switchKit: async (id) => {
    const token = ++loadToken;
    const meta = get().index.find((k) => k.id === id);
    const { fetch, sampler, engine } = getRuntime();
    // A resident (preloaded) kit switches without a loading state, so the pads never blink disabled.
    if (!sampler.residentKitIds.includes(id) || !get().manifests[id])
      set({ status: 'loading', error: null, progress: { loaded: 0, total: meta?.totalBytes ?? 0 } });
    try {
      await preloading.get(id);
      const base = kitBaseUrl(get().index, id);
      const manifest = get().manifests[id] ?? (await fetchKitManifest(base, id, fetch));
      if (token === loadToken) set({ manifests: { ...get().manifests, [id]: manifest } });
      const kit = await sampler.loadKit(manifest, `${base}${id}/`, (progress) => {
        if (token === loadToken) set({ progress });
      });
      if (token !== loadToken) return; // a newer switch won
      engine.setKit(kit);
      const available = new Set(
        manifest.articulations.map((a) => a.id).filter((a) => !kit.unavailable.has(a)),
      );
      set({ currentKitId: id, manifest, status: 'ready', error: null, available });
      useSettingsStore.getState().setLastKitId(id);
    } catch (e) {
      if (token !== loadToken) return;
      set({ status: get().manifest ? 'ready' : 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  switchKitNow: (id) => {
    const { sampler, engine } = getRuntime();
    const manifest = get().manifests[id];
    const kit = manifest && sampler.peek(id);
    if (!manifest || !kit) return false;
    loadToken++; // cancels any switch still loading
    engine.setKit(kit);
    const available = new Set(manifest.articulations.map((a) => a.id).filter((a) => !kit.unavailable.has(a)));
    set({ currentKitId: id, manifest, status: 'ready', error: null, available });
    useSettingsStore.getState().setLastKitId(id);
    return true;
  },

  preloadKit: async (id) => {
    if (id === get().currentKitId) return;
    const { fetch, sampler } = getRuntime();
    if (sampler.residentKitIds.includes(id)) return;
    const pending = preloading.get(id);
    if (pending) return pending;
    const base = kitBaseUrl(get().index, id);
    const job = (async () => {
      try {
        const manifest = get().manifests[id] ?? (await fetchKitManifest(base, id, fetch));
        set({ manifests: { ...get().manifests, [id]: manifest } });
        await sampler.loadKit(manifest, `${base}${id}/`);
      } catch {
        // A failed preload is retried as a normal switch, which reports the error.
      } finally {
        preloading.delete(id);
      }
    })();
    preloading.set(id, job);
    return job;
  },
}));
