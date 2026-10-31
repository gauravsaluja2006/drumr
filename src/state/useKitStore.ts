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
}

let loadToken = 0;

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
      const { kitsBaseUrl, fetch } = getRuntime();
      const index = await fetchKitIndex(kitsBaseUrl, fetch);
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
    const { kitsBaseUrl, fetch } = getRuntime();
    const missing = get().index.filter((k) => !get().manifests[k.id]);
    const loaded = await Promise.allSettled(missing.map((k) => fetchKitManifest(kitsBaseUrl, k.id, fetch)));
    const add: Record<string, KitManifest> = {};
    for (const r of loaded) if (r.status === 'fulfilled') add[r.value.id] = r.value;
    set({ manifests: { ...get().manifests, ...add } });
  },

  switchKit: async (id) => {
    const token = ++loadToken;
    const meta = get().index.find((k) => k.id === id);
    set({ status: 'loading', error: null, progress: { loaded: 0, total: meta?.totalBytes ?? 0 } });
    try {
      const { kitsBaseUrl, fetch, sampler, engine } = getRuntime();
      const manifest = get().manifests[id] ?? (await fetchKitManifest(kitsBaseUrl, id, fetch));
      if (token === loadToken) set({ manifests: { ...get().manifests, [id]: manifest } });
      const kit = await sampler.loadKit(manifest, `${kitsBaseUrl}${id}/`, (progress) => {
        if (token === loadToken) set({ progress });
      });
      if (token !== loadToken) return; // a newer switch won
      engine.setKit(kit);
      const available = new Set(
        manifest.articulations.map((a) => a.id).filter((a) => !kit.unavailable.has(a)),
      );
      set({ currentKitId: id, manifest, status: 'ready', available });
      useSettingsStore.getState().setLastKitId(id);
    } catch (e) {
      if (token !== loadToken) return;
      set({ status: get().manifest ? 'ready' : 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },
}));
