import { create } from 'zustand';
import type { KitManifest } from '@/kits/schema';

/** Cache names shared with the Workbox runtime caching rules in vite.config.ts. */
export const AUDIO_CACHE = 'drumr-kit-audio';
export const JSON_CACHE = 'drumr-kit-json';

export const useOfflineStore = create<{ readyKitIds: string[] }>()(() => ({ readyKitIds: [] }));

/**
 * The first kit load happens before the service worker controls the page, so those responses never
 * pass through it. Once a worker is active, copy the current kit into the runtime caches so the app
 * and that kit work offline. Fetches come from the HTTP cache, so this costs almost nothing.
 */
export async function warmKitCache(manifest: KitManifest, kitsBaseUrl: string): Promise<boolean> {
  if (typeof caches === 'undefined' || !('serviceWorker' in navigator)) return false;
  await navigator.serviceWorker.ready;
  const kitBase = `${kitsBaseUrl}${manifest.id}/`;
  const audio = [...new Set(manifest.articulations.flatMap((a) => a.layers.flatMap((l) => l.samples)))].map(
    (s) => kitBase + s,
  );
  try {
    const [audioCache, jsonCache] = await Promise.all([caches.open(AUDIO_CACHE), caches.open(JSON_CACHE)]);
    const missing = (
      await Promise.all(audio.map(async (url) => ((await audioCache.match(url)) ? null : url)))
    ).filter((u): u is string => u !== null);
    await Promise.all([
      audioCache.addAll(missing),
      jsonCache.addAll([`${kitsBaseUrl}index.json`, `${kitBase}manifest.json`]),
    ]);
  } catch {
    return false;
  }
  const ids = useOfflineStore.getState().readyKitIds;
  if (!ids.includes(manifest.id)) useOfflineStore.setState({ readyKitIds: [...ids, manifest.id] });
  return true;
}
