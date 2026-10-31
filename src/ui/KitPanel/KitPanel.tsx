import { useKitStore } from '@/state/useKitStore';

export function formatBytes(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function KitPanel() {
  const manifest = useKitStore((s) => s.manifest);
  const status = useKitStore((s) => s.status);
  const error = useKitStore((s) => s.error);

  return (
    <div className="flex flex-col gap-3">
      {manifest ? (
        <>
          <p className="text-base font-medium text-fg-0">{manifest.name}</p>
          <p className="text-fg-1">{manifest.description}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href={manifest.license.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-s border border-line px-2 py-0.5 font-mono text-fg-1 hover:text-fg-0"
            >
              {manifest.license.name}
            </a>
            <span className="font-mono text-fg-2">{formatBytes(manifest.totalBytes)}</span>
          </div>
          <a
            href={manifest.attribution.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-fg-1 underline-offset-2 hover:underline"
          >
            {manifest.attribution.author}
          </a>
        </>
      ) : (
        <p className="text-fg-1">{status === 'error' ? 'No kit loaded.' : 'Loading kit…'}</p>
      )}
      {error && (
        <p role="alert" className="rounded-s border border-err/40 bg-err/10 px-3 py-2 text-xs text-fg-0">
          {error}
        </p>
      )}
    </div>
  );
}
