import { describe, expect, test } from 'vitest';
import { fetchKitIndex, fetchKitManifest, joinUrl, KitLoadError, type FetchLike } from '@/kits/loader';
import { testManifest } from '../fakes/kits';

const fetchFrom =
  (routes: Record<string, unknown>): FetchLike =>
  async (url) => {
    const body = routes[url];
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  };

describe('kit loader', () => {
  test('joinUrl handles trailing slash', () => {
    expect(joinUrl('/kits/', 'a')).toBe('/kits/a');
    expect(joinUrl('/kits', 'a')).toBe('/kits/a');
  });

  test('fetches and validates index and manifest', async () => {
    const f = fetchFrom({
      '/kits/index.json': [{ id: 'test-kit', name: 'T', description: '', totalBytes: 1 }],
      '/kits/test-kit/manifest.json': testManifest(),
    });
    expect(await fetchKitIndex('/kits/', f)).toHaveLength(1);
    expect((await fetchKitManifest('/kits/', 'test-kit', f)).name).toBe('Test Kit');
  });

  test('reports HTTP and schema errors as KitLoadError', async () => {
    const f = fetchFrom({
      '/kits/index.json': [{}],
      '/kits/bad/manifest.json': { ...testManifest(), schemaVersion: 2 },
    });
    await expect(fetchKitIndex('/nope/', f)).rejects.toThrow(/404/);
    await expect(fetchKitIndex('/kits/', f)).rejects.toThrow(KitLoadError);
    await expect(fetchKitManifest('/kits/', 'missing', f)).rejects.toThrow(/404/);
    await expect(fetchKitManifest('/kits/', 'bad', f)).rejects.toThrow(/schemaVersion/);
  });
});
