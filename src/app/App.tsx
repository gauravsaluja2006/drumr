import { useEffect, useMemo, useState } from 'react';
import { PadGrid } from '@/ui/PadGrid/PadGrid';
import { StatusBar } from '@/ui/StatusBar/StatusBar';
import { KitPanel } from '@/ui/KitPanel/KitPanel';
import { Mixer } from '@/ui/Mixer/Mixer';
import { AudioOverlay } from '@/ui/AudioOverlay/AudioOverlay';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { attachKeyboard } from '@/input/keyboard';
import { getRuntime, type Runtime } from './runtime';
import { hitPad } from './controller';
import { TEMP_PADS } from './tempMapping';
import { installTestHooks } from './testHooks';

function Panel({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold tracking-wider text-fg-2 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function useRuntime(): Runtime | null {
  const [rt] = useState<Runtime | null>(() => {
    try {
      return getRuntime();
    } catch {
      return null;
    }
  });
  return rt;
}

export function App() {
  const runtime = useRuntime();
  const status = useKitStore((s) => s.status);
  const available = useKitStore((s) => s.available);
  const masterDb = useSettingsStore((s) => s.masterDb);

  useEffect(() => {
    if (!runtime) {
      useKitStore.setState({ status: 'error', error: 'Web Audio is not supported in this browser.' });
      return;
    }
    installTestHooks(runtime);
    if (useKitStore.getState().status === 'idle') void useKitStore.getState().init();
    return attachKeyboard(window, hitPad);
  }, [runtime]);

  useEffect(() => {
    runtime?.engine.setMasterGainDb(masterDb);
  }, [runtime, masterDb]);

  const pads = useMemo(
    () =>
      TEMP_PADS.map((p) => ({ label: p.label, unavailable: status === 'ready' && !available.has(p.voice) })),
    [status, available],
  );

  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <main className="grid flex-1 grid-cols-1 gap-6 p-4 lg:grid-cols-[280px_1fr_240px] lg:p-6">
        <aside className="hidden flex-col gap-8 rounded-l border border-line bg-bg-1 p-5 lg:flex">
          <Panel title="Kit">
            <KitPanel />
          </Panel>
          <Panel title="Mixer">
            <Mixer />
          </Panel>
        </aside>
        <div className="flex items-center justify-center">
          <PadGrid pads={pads} disabled={status !== 'ready'} onHit={hitPad} />
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
      <AudioOverlay ctx={runtime?.ctx ?? null} />
    </div>
  );
}
