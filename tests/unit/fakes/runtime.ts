import { createRuntime, setRuntime, type Runtime } from '@/app/runtime';
import type { FetchLike } from '@/kits/loader';
import { FakeAudioContext } from './FakeAudioContext';
import { testManifest } from './kits';

/** Installs a runtime backed by FakeAudioContext and an in-memory kit server. */
export function installFakeRuntime(
  opts: { failKit?: string; delayMs?: number; localKits?: boolean } = {},
): Runtime & { ctx: FakeAudioContext; requested: string[] } {
  const manifests = {
    'test-kit': testManifest(),
    'kit-b': testManifest({ id: 'kit-b', name: 'Kit B' }),
  };
  const index = Object.values(manifests).map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    totalBytes: m.totalBytes,
  }));
  const requested: string[] = [];
  const local = testManifest({ id: 'big-local', name: 'Big Local' });
  const fetchImpl: FetchLike = async (url) => {
    requested.push(url);
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const json = (body: unknown, ok = true) => ({
      ok,
      status: ok ? 200 : 404,
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(100),
    });
    if (url === '/kits/index.json') return json(index);
    if (opts.localKits && url === '/kits-local/index.json')
      return json([{ id: local.id, name: local.name, description: '', totalBytes: 1 }, index[0]]);
    if (opts.localKits && url === '/kits-local/big-local/manifest.json') return json(local);
    const m = /^\/kits\/([^/]+)\/manifest\.json$/.exec(url);
    if (m) {
      const id = m[1] as keyof typeof manifests;
      return json(manifests[id], !!manifests[id] && id !== opts.failKit);
    }
    return json(null);
  };
  const ctx = new FakeAudioContext();
  const rt = Object.assign(createRuntime(ctx, fetchImpl, '/kits/', undefined, '/kits-local/'), {
    requested,
  }) as Runtime & {
    ctx: FakeAudioContext;
    requested: string[];
  };
  setRuntime(rt);
  return rt;
}
