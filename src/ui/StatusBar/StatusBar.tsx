import { LoadingBar } from '@/ui/LoadingBar/LoadingBar';
import { MidiBanner, MidiStatus } from '@/ui/MidiStatus/MidiStatus';
import { useUiStore } from '@/state/useUiStore';

export function StatusBar() {
  const openSettings = useUiStore((s) => s.openSettings);
  return (
    <header className="relative z-20 border-b border-line bg-bg-1">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
          />
          <h1 className="text-base font-semibold">Drumr</h1>
        </div>
        <div className="flex items-center gap-2">
          <MidiStatus />
          <button
            type="button"
            onClick={() => openSettings('sound')}
            title="Settings (,)"
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 4h7M13 4h1M2 12h1M7 12h7" strokeLinecap="round" />
              <circle cx="11" cy="4" r="2" />
              <circle cx="5" cy="12" r="2" />
            </svg>
            Settings
          </button>
        </div>
      </div>
      <LoadingBar />
      <MidiBanner />
    </header>
  );
}
