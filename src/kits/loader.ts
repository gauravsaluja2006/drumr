import { firstIssue, kitIndexSchema, kitManifestSchema, type KitIndex, type KitManifest } from './schema';

export type FetchLike = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'arrayBuffer'>>;

export class KitLoadError extends Error {
  constructor(
    message: string,
    readonly kitId?: string,
  ) {
    super(message);
    this.name = 'KitLoadError';
  }
}

export function joinUrl(base: string, path: string): string {
  return base.endsWith('/') ? base + path : `${base}/${path}`;
}

export async function fetchKitIndex(baseUrl: string, fetchImpl: FetchLike): Promise<KitIndex> {
  const res = await fetchImpl(joinUrl(baseUrl, 'index.json'));
  if (!res.ok) throw new KitLoadError(`Kit index request failed (${res.status})`);
  const parsed = kitIndexSchema.safeParse(await res.json());
  if (!parsed.success) throw new KitLoadError(`Kit index invalid: ${firstIssue(parsed.error)}`);
  return parsed.data;
}

export async function fetchKitManifest(
  baseUrl: string,
  kitId: string,
  fetchImpl: FetchLike,
): Promise<KitManifest> {
  const res = await fetchImpl(joinUrl(baseUrl, `${kitId}/manifest.json`));
  if (!res.ok) throw new KitLoadError(`Manifest for "${kitId}" failed (${res.status})`, kitId);
  const parsed = kitManifestSchema.safeParse(await res.json());
  if (!parsed.success) throw new KitLoadError(`Kit "${kitId}" invalid: ${firstIssue(parsed.error)}`, kitId);
  return parsed.data;
}
