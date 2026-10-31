import { createRuntime, setRuntime, type Runtime } from '@/app/runtime';
import type { FetchLike } from '@/kits/loader';
import { FakeAudioContext } from './FakeAudioContext';
import { testManifest } from './kits';

/** Installs a runtime backed by FakeAudioContext and an in-memory kit server. */
export function installFakeRuntime(
  opts: { failKit?: string; delayMs?: number } = {},
): Runtime & { ctx: FakeAudioContext } {
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
  const fetchImpl: FetchLike = async (url) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    const json = (body: unknown, ok = true) => ({
      ok,
      status: ok ? 200 : 404,
      json: async () => body,
      arrayBuffer: async () => new ArrayBuffer(100),
    });
    if (url === '/kits/index.json') return json(index);
    const m = /^\/kits\/([^/]+)\/manifest\.json$/.exec(url);
    if (m) {
      const id = m[1] as keyof typeof manifests;
      return json(manifests[id], !!manifests[id] && id !== opts.failKit);
    }
    return json(null);
  };
  const ctx = new FakeAudioContext();
  const rt = createRuntime(ctx, fetchImpl, '/kits/') as Runtime & { ctx: FakeAudioContext };
  setRuntime(rt);
  return rt;
}
