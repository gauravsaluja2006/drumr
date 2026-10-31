import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { PadGrid } from '@/ui/PadGrid/PadGrid';
import { StatusBar } from '@/ui/StatusBar/StatusBar';
import { KitPanel } from '@/ui/KitPanel/KitPanel';
import { Mixer } from '@/ui/Mixer/Mixer';
import { AudioOverlay } from '@/ui/AudioOverlay/AudioOverlay';
import { useKitStore } from '@/state/useKitStore';
import { DEFAULT_GROUP, useSettingsStore } from '@/state/useSettingsStore';
import { GROUPS } from '@/kits/schema';
import { attachKeyboard } from '@/input/keyboard';
import { getRuntime, type Runtime } from './runtime';
import { handleMidi, hitPad, resolvePadVoice } from './controller';
import { useMappingStore } from '@/state/useMappingStore';
import { bindMidiStore } from '@/state/useMidiStore';
import { padIndex } from '@/mapping/schema';
import { voiceLabel } from '@/mapping/voices';
import { VelocityPanel } from '@/ui/VelocityPanel/VelocityPanel';
import { PresetSelect } from '@/ui/PresetSelect/PresetSelect';
import { HiHatMeter } from '@/ui/HiHatMeter/HiHatMeter';
import { MobilePanels } from '@/ui/MobilePanels/MobilePanels';
import { DESKTOP, useMediaQuery } from './media';
import { useOfflineStore, warmKitCache } from './offline';
import { useUiStore } from '@/state/useUiStore';
import { installTestHooks } from './testHooks';

// Panels that are not needed for the first paint load on demand (docs/04-ROADMAP.md Phase 7).
const About = lazy(() => import('@/ui/About/About').then((m) => ({ default: m.About })));
const MappingEditor = lazy(() =>
  import('@/ui/MappingEditor/MappingEditor').then((m) => ({ default: m.MappingEditor })),
);
const DebugPanel = lazy(() => import('@/ui/DebugPanel/DebugPanel').then((m) => ({ default: m.DebugPanel })));

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
  const [debugOpen, setDebugOpen] = useState(false);
  const { editing, selectedPad, learning, setEditing } = useUiStore();
  const desktop = useMediaQuery(DESKTOP, true);

  // "m" toggles the layout editor ("e" is a pad key), "`" the debug panel; Escape closes the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))
        return;
      if (e.key === '`') setDebugOpen((o) => !o);
      else if (e.key === 'm' || e.key === 'M') setEditing(!useUiStore.getState().editing);
      else if (
        e.key === 'Escape' &&
        useUiStore.getState().editing &&
        !document.querySelector('[role="dialog"]')
      )
        setEditing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setEditing]);

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

  // Per-kit group mix → engine group gains (muted = silence).
  const kitId = useKitStore((s) => s.currentKitId);
  const kitMix = useSettingsStore((s) => (kitId ? s.mix[kitId] : undefined));
  useEffect(() => {
    if (!runtime) return;
    for (const g of GROUPS) {
      const setting = kitMix?.[g] ?? DEFAULT_GROUP;
      runtime.engine.setGroupGainDb(g, setting.muted ? -Infinity : setting.db);
    }
  }, [runtime, kitMix]);

  // Make the current kit available offline once a service worker is active.
  const manifest = useKitStore((s) => s.manifest);
  const offlineReady = useOfflineStore((s) => !!kitId && s.readyKitIds.includes(kitId));
  useEffect(() => {
    if (runtime && manifest && status === 'ready') void warmKitCache(manifest, runtime.kitsBaseUrl);
  }, [runtime, manifest, status]);

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
        {desktop && (
          <aside className="flex flex-col gap-8 rounded-l border border-line bg-bg-1 p-5">
            <Panel title="Kit">
              <KitPanel />
            </Panel>
            <Panel title="Mixer">
              <Mixer />
            </Panel>
          </aside>
        )}
        <div className="flex flex-col items-center justify-center gap-4">
          <PadGrid
            pads={pads}
            disabled={status !== 'ready'}
            selectedIndex={editing ? selectedPad : null}
            learning={learning}
            onHit={hitPad}
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PresetSelect />
            <button
              type="button"
              aria-pressed={editing}
              onClick={() => setEditing(!editing)}
              className="rounded-m border border-line px-3 py-1.5 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0 aria-pressed:border-accent aria-pressed:text-accent"
            >
              {editing ? 'Editing layout' : 'Edit layout'}{' '}
              <span className="ml-1 hidden font-mono text-fg-2 lg:inline">M</span>
            </button>
          </div>
          {!desktop && (
            <MobilePanels
              tabs={[
                {
                  id: 'mix',
                  label: 'Kit & mixer',
                  content: (
                    <>
                      <KitPanel />
                      <Mixer />
                    </>
                  ),
                },
                {
                  id: 'hihat',
                  label: 'Hi-hat & velocity',
                  content: (
                    <>
                      <HiHatMeter />
                      <VelocityPanel />
                    </>
                  ),
                },
              ]}
            />
          )}
        </div>
        {editing ? (
          <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-l border border-line bg-bg-1 p-5 shadow-2xl lg:static lg:max-h-none lg:rounded-l lg:shadow-none">
            <Suspense fallback={<p className="text-fg-1">Loading editor…</p>}>
              <MappingEditor />
            </Suspense>
          </aside>
        ) : (
          desktop && (
            <aside className="flex flex-col gap-8 rounded-l border border-line bg-bg-1 p-5">
              <Panel title="Hi-hat">
                <HiHatMeter />
              </Panel>
              <Panel title="Velocity">
                <VelocityPanel />
              </Panel>
            </aside>
          )
        )}
      </main>
      <footer className="flex h-10 items-center justify-between border-t border-line px-4 text-xs text-fg-2 lg:px-6">
        <span className="flex items-center gap-3">
          <button type="button" onClick={() => setAboutOpen(true)} className="text-fg-1 hover:text-fg-0">
            About · Sources &amp; licences
          </button>
          <span className="hidden text-fg-2 md:inline">Web MIDI · Web Audio · open-licence drum samples</span>
        </span>
        <span className="flex items-center gap-3 font-mono">
          {offlineReady && (
            <span data-testid="offline-ready" className="flex items-center gap-1.5 text-fg-1">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
              Available offline
            </span>
          )}
          <button
            type="button"
            onClick={() => setDebugOpen((o) => !o)}
            className="hidden text-fg-1 hover:text-fg-0 sm:inline"
          >
            Debug
          </button>
          <span>
            v{__APP_VERSION__} · {__COMMIT__}
          </span>
        </span>
      </footer>
      <Suspense fallback={null}>
        {aboutOpen && <About open onClose={() => setAboutOpen(false)} />}
        {debugOpen && <DebugPanel onClose={() => setDebugOpen(false)} />}
      </Suspense>
      <AudioOverlay ctx={runtime?.ctx ?? null} />
    </div>
  );
}
