import { PadGrid } from '@/ui/PadGrid/PadGrid';
import { StatusBar } from '@/ui/StatusBar/StatusBar';

function Panel({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wider text-fg-2 uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function App() {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <main className="grid flex-1 grid-cols-1 gap-6 p-4 lg:grid-cols-[280px_1fr_240px] lg:p-6">
        <aside className="hidden flex-col gap-8 rounded-l border border-line bg-bg-1 p-5 lg:flex">
          <Panel title="Kit">
            <p className="text-fg-1">Kits arrive in Phase 2.</p>
          </Panel>
          <Panel title="Mixer" />
        </aside>
        <div className="flex items-center justify-center">
          <PadGrid />
        </div>
        <aside className="hidden flex-col gap-8 rounded-l border border-line bg-bg-1 p-5 lg:flex">
          <Panel title="Hi-hat" />
          <Panel title="Velocity" />
        </aside>
      </main>
      <footer className="flex h-10 items-center justify-between border-t border-line px-4 text-xs text-fg-2 lg:px-6">
        <span className="hidden sm:inline">Web MIDI · Web Audio · open-licence drum samples</span>
        <span className="font-mono">
          v{__APP_VERSION__} · {__COMMIT__}
        </span>
      </footer>
    </div>
  );
}
