import { LoadingBar } from '@/ui/LoadingBar/LoadingBar';
import { KitSelector } from '@/ui/KitSelector/KitSelector';
import { MidiBanner, MidiStatus } from '@/ui/MidiStatus/MidiStatus';

export function StatusBar() {
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
        <KitSelector />
        <MidiStatus />
      </div>
      <LoadingBar />
      <MidiBanner />
    </header>
  );
}
