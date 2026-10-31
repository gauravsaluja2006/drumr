import { useEffect, useMemo, useState } from 'react';
import { PadGrid } from '@/ui/PadGrid/PadGrid';
import { StatusBar } from '@/ui/StatusBar/StatusBar';
import { KitPanel } from '@/ui/KitPanel/KitPanel';
import { Mixer } from '@/ui/Mixer/Mixer';
import { AudioOverlay } from '@/ui/AudioOverlay/AudioOverlay';
import { About } from '@/ui/About/About';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { attachKeyboard } from '@/input/keyboard';
import { getRuntime, type Runtime } from './runtime';
import { handleMidi, hitPad, resolvePadVoice } from './controller';
import { useMappingStore } from '@/state/useMappingStore';
import { bindMidiStore } from '@/state/useMidiStore';
import { padIndex } from '@/mapping/schema';
import { voiceLabel } from '@/mapping/voices';
import { VelocityPanel } from '@/ui/VelocityPanel/VelocityPanel';
import { PresetSelect } from '@/ui/PresetSelect/PresetSelect';
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
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!runtime) {
      useKitStore.setState({ status: 'error', error: 'Web Audio is not supported in this browser.' });
      return;
    }
    installTestHooks(runtime);
    if (useKitStore.getState().status === 'idle') void useKitStore.getState().init();
    const unbindMidi = bindMidiStore(runtime.midi);
    runtime.midi.setMessageHandler(handleMidi);
    void runtime.midi.init();
    const detachKeyboard = attachKeyboard(window, hitPad);
    return () => {
      unbindMidi();
      detachKeyboard();
    };
  }, [runtime]);

  useEffect(() => {
    runtime?.engine.setMasterGainDb(masterDb);
  }, [runtime, masterDb]);

  const mapping = useMappingStore((s) => s.mapping);
  const pads = useMemo(() => {
    const views: { label?: string; note?: number; unavailable?: boolean }[] = [];
    for (const p of mapping.pads) {
      views[padIndex(mapping, p)] = {
        label: p.label ?? voiceLabel(p.voice),
        note: p.note,
        unavailable: status === 'ready' && resolvePadVoice(p.voice) === null,
      };
    }
    return views;
    // `available` is read inside resolvePadVoice via the kit store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping, status, available]);

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
        <div className="flex flex-col items-center justify-center gap-4">
          <PadGrid pads={pads} disabled={status !== 'ready'} onHit={hitPad} />
          <PresetSelect />
        </div>
        <aside className="hidden flex-col gap-8 rounded-l border border-line bg-bg-1 p-5 lg:flex">
          <Panel title="Hi-hat" />
          <Panel title="Velocity">
            <VelocityPanel />
          </Panel>
        </aside>
      </main>
      <footer className="flex h-10 items-center justify-between border-t border-line px-4 text-xs text-fg-2 lg:px-6">
        <span className="flex items-center gap-3">
          <button type="button" onClick={() => setAboutOpen(true)} className="text-fg-1 hover:text-fg-0">
            About · Sources &amp; licences
          </button>
          <span className="hidden text-fg-2 md:inline">Web MIDI · Web Audio · open-licence drum samples</span>
        </span>
        <span className="font-mono">
          v{__APP_VERSION__} · {__COMMIT__}
        </span>
      </footer>
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <AudioOverlay ctx={runtime?.ctx ?? null} />
    </div>
  );
}
