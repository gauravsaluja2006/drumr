import { useKitStore } from '@/state/useKitStore';
import { LoadingBar } from '@/ui/LoadingBar/LoadingBar';

export function StatusBar() {
  const manifest = useKitStore((s) => s.manifest);
  const status = useKitStore((s) => s.status);
  const { loaded, total } = useKitStore((s) => s.progress);
  const kitText =
    status === 'loading'
      ? `Loading… ${total ? Math.round((loaded / total) * 100) : 0}%`
      : (manifest?.name ?? (status === 'error' ? 'No kit' : '—'));

  return (
    <header className="border-b border-line bg-bg-1">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
          />
          <h1 className="text-base font-semibold">Drumr</h1>
        </div>
        <div className="hidden text-sm text-fg-1 sm:block" aria-live="polite">
          <span className="text-fg-2">Kit</span>{' '}
          <span className="ml-1 text-fg-0" data-testid="kit-name">
            {kitText}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-fg-1">
          <span aria-hidden="true" className="size-2 rounded-full border border-fg-2" />
          <span>MIDI: no device</span>
        </div>
      </div>
      <LoadingBar />
    </header>
  );
}
