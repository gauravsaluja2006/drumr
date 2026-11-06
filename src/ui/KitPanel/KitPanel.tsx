import { useKitStore } from '@/state/useKitStore';

export function KitPanel() {
  const manifest = useKitStore((s) => s.manifest);
  const status = useKitStore((s) => s.status);
  const error = useKitStore((s) => s.error);

  return (
    <div className="flex flex-col gap-3">
      {manifest ? (
        <>
          <p className="text-base font-medium text-fg-0" data-testid="kit-name">
            {manifest.name}
          </p>
          <p className="text-fg-1">{manifest.description}</p>
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
