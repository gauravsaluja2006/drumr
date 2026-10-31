import { afterEach, describe, expect, test, vi } from 'vitest';
import { AUDIO_CACHE, JSON_CACHE, useOfflineStore, warmKitCache } from '@/app/offline';
import { testManifest } from '../fakes/kits';

afterEach(() => {
  vi.unstubAllGlobals();
  useOfflineStore.setState({ readyKitIds: [] });
});

function fakeCaches(fail = false) {
  const stores = new Map<string, Set<string>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Set());
    const s = stores.get(name)!;
    return {
      match: async (url: string) => (s.has(url) ? new Response('') : undefined),
      addAll: async (urls: string[]) => {
        if (fail) throw new Error('quota');
        urls.forEach((u) => s.add(u));
      },
    };
  };
  return { stores, api: { open } };
}

describe('warmKitCache', () => {
  test('without Cache API or service workers it does nothing', async () => {
    expect(await warmKitCache(testManifest(), '/kits/')).toBe(false);
  });

  test('copies the kit audio and JSON into the runtime caches once a worker is ready', async () => {
    const { stores, api } = fakeCaches();
    vi.stubGlobal('caches', api);
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { ready: Promise.resolve() } });
    stores.set(AUDIO_CACHE, new Set(['/kits/test-kit/kick_v1.wav'])); // already cached: not re-added
    expect(await warmKitCache(testManifest(), '/kits/')).toBe(true);
    expect(stores.get(AUDIO_CACHE)!.size).toBe(6);
    expect([...stores.get(JSON_CACHE)!]).toEqual(['/kits/index.json', '/kits/test-kit/manifest.json']);
    expect(useOfflineStore.getState().readyKitIds).toEqual(['test-kit']);
    await warmKitCache(testManifest(), '/kits/');
    expect(useOfflineStore.getState().readyKitIds).toEqual(['test-kit']);
  });

  test('reports failure when caching fails (e.g. quota)', async () => {
    vi.stubGlobal('caches', fakeCaches(true).api);
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { ready: Promise.resolve() } });
    expect(await warmKitCache(testManifest(), '/kits/')).toBe(false);
    expect(useOfflineStore.getState().readyKitIds).toEqual([]);
  });
});
