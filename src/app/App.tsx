import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { PadGrid, type PadView } from '@/ui/PadGrid/PadGrid';
import { StatusBar } from '@/ui/StatusBar/StatusBar';
import { KitPanel } from '@/ui/KitPanel/KitPanel';
import { KitList } from '@/ui/KitList/KitList';
import { LoopBar } from '@/ui/LoopBar/LoopBar';
import { Mixer } from '@/ui/Mixer/Mixer';
import { AudioOverlay } from '@/ui/AudioOverlay/AudioOverlay';
import { kitBaseUrl, useKitStore } from '@/state/useKitStore';
import { DEFAULT_GROUP, fxFor, useSettingsStore } from '@/state/useSettingsStore';
import { SoundQuick } from '@/ui/EffectsPanel/EffectsPanel';
import { GROUPS } from '@/kits/schema';
import { attachKeyboard } from '@/input/keyboard';
import { getRuntime, type Runtime } from './runtime';
import { handleMidi, hitPad, resolvePadVoice } from './controller';
import { useMappingStore } from '@/state/useMappingStore';
import { bindMidiStore } from '@/state/useMidiStore';
import { padIndex } from '@/mapping/schema';
import { voiceLabel } from '@/mapping/voices';
import { HiHatMeter } from '@/ui/HiHatMeter/HiHatMeter';
import { MobilePanels } from '@/ui/MobilePanels/MobilePanels';
import { DESKTOP, useMediaQuery } from './media';
import { useOfflineStore, warmKitCache } from './offline';
import { useUiStore } from '@/state/useUiStore';
import { installTestHooks } from './testHooks';
import { installLooper, loopMain, loopStopPlay } from './looper';

// Panels that are not needed for the first paint load on demand (docs/04-ROADMAP.md Phase 7).
const About = lazy(() => import('@/ui/About/About').then((m) => ({ default: m.About })));
const MappingEditor = lazy(() =>
  import('@/ui/MappingEditor/MappingEditor').then((m) => ({ default: m.MappingEditor })),
);
const Settings = lazy(() => import('@/ui/Settings/Settings').then((m) => ({ default: m.Settings })));
const DebugPanel = lazy(() => import('@/ui/DebugPanel/DebugPanel').then((m) => ({ default: m.DebugPanel })));

function Panel({
  title,
  children,
  className = '',
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={`flex flex-col gap-3 ${className}`}>
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
  const { aboutOpen, debugOpen, setAboutOpen, setDebugOpen } = useUiStore();
  const settingsOpen = useUiStore((s) => s.settings !== null);
  const { editing, selectedPad, learning, setEditing } = useUiStore();
  const desktop = useMediaQuery(DESKTOP, true);

  // "m" toggles the layout editor ("e" is a pad key), "`" the debug panel; Escape closes the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))
        return;
      if (e.key === '`') setDebugOpen(!useUiStore.getState().debugOpen);
      else if (e.key === 'l' && !e.repeat) loopMain(e.timeStamp || performance.now());
      else if (e.key === 'L' && !e.repeat) loopStopPlay(e.timeStamp || performance.now());
      else if (e.key === ',' && !document.querySelector('[role="dialog"]'))
        useUiStore.getState().openSettings('sound');
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
  }, [setEditing, setDebugOpen]);

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
    const uninstallLooper = installLooper();
    return () => {
      unbindMidi();
      detachKeyboard();
      uninstallLooper();
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
      runtime.engine.setGroupTone(g, { tune: setting.tune ?? 0, decay: setting.decay ?? 1 });
    }
  }, [runtime, kitMix]);
  const humanize = useSettingsStore((s) => s.humanize);
  useEffect(() => {
    runtime?.engine.setHumanize(humanize);
  }, [runtime, humanize]);

  // Per-kit effects and the echo tempo → engine sends.
  const kitFx = useSettingsStore((s) => fxFor(s, kitId));
  const bpm = useSettingsStore((s) => s.rotation.bpm);
  useEffect(() => {
    runtime?.engine.effects.setTempo(bpm);
  }, [runtime, bpm]);
  useEffect(() => {
    runtime?.engine.effects.set(kitFx);
  }, [runtime, kitFx]);

  // Make the current kit available offline once a service worker is active.
  const manifest = useKitStore((s) => s.manifest);
  const offlineReady = useOfflineStore((s) => !!kitId && s.readyKitIds.includes(kitId));
  useEffect(() => {
    if (runtime && manifest && status === 'ready')
      void warmKitCache(manifest, kitBaseUrl(useKitStore.getState().index, manifest.id));
  }, [runtime, manifest, status]);

  const mapping = useMappingStore((s) => s.mapping);
  const pads = useMemo(() => {
    const views: PadView[] = [];
    const arts = useKitStore.getState().manifest?.articulations;
    for (const p of mapping.pads) {
      const art = status === 'ready' ? resolvePadVoice(p.voice) : null;
      views[padIndex(mapping, p)] = {
        label: p.label ?? voiceLabel(p.voice),
        note: p.note,
        unavailable: status === 'ready' && art === null,
        group: arts?.find((a) => a.id === art)?.group,
      };
    }
    return views;
    // `available` is read inside resolvePadVoice via the kit store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping, status, available]);

  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 p-4 lg:grid-cols-[340px_1fr_240px] lg:grid-rows-[minmax(0,1fr)] lg:p-6">
        {desktop && (
          <aside className="flex min-h-0 flex-col gap-5 rounded-l border border-line bg-bg-1 p-5">
            <Panel title="Kits" className="min-h-0 flex-1">
              <KitList />
            </Panel>
            <div className="border-t border-line pt-4">
              <KitPanel />
            </div>
          </aside>
        )}
        <div
          className={`flex flex-col items-center justify-center gap-4 ${
            desktop ? '[--grid-reserve:400px] [@media(max-height:800px)]:[--grid-reserve:340px]' : ''
          }`}
        >
          <PadGrid
            pads={pads}
            disabled={status !== 'ready'}
            selectedIndex={editing ? selectedPad : null}
            learning={learning}
            onHit={hitPad}
          />
          <LoopBar />
          {desktop && (
            <section aria-label="Mixer" className="w-full">
              <Mixer layout="strip" />
            </section>
          )}
          {!desktop && (
            <MobilePanels
              tabs={[
                {
                  id: 'mix',
                  label: 'Kit & mixer',
                  content: (
                    <>
                      <div className="flex max-h-80 min-h-0 flex-col">
                        <KitList />
                      </div>
                      <KitPanel />
                      <Mixer />
                      <Panel title="Sound" className="border-t border-line pt-4">
                        <SoundQuick />
                      </Panel>
                    </>
                  ),
                },
                {
                  id: 'hihat',
                  label: 'Hi-hat',
                  content: <HiHatMeter settings={false} />,
                },
              ]}
            />
          )}
        </div>
        {editing ? (
          <aside className="fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-l border border-line bg-bg-1 p-5 shadow-2xl lg:static lg:max-h-none lg:min-h-0 lg:rounded-l lg:shadow-none">
            <Suspense fallback={<p className="text-fg-1">Loading editor…</p>}>
              <MappingEditor />
            </Suspense>
          </aside>
        ) : (
          desktop && (
            <aside className="flex min-h-0 flex-col gap-8 overflow-y-auto rounded-l border border-line bg-bg-1 p-5">
              <Panel title="Sound">
                <SoundQuick />
              </Panel>
              <Panel title="Hi-hat">
                <HiHatMeter settings={false} />
              </Panel>
            </aside>
          )
        )}
      </main>
      <footer className="flex h-8 items-center justify-end gap-3 border-t border-line px-4 font-mono text-[11px] text-fg-2 lg:px-6">
        {offlineReady && (
          <span data-testid="offline-ready" className="flex items-center gap-1.5 text-fg-1">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
            Available offline
          </span>
        )}
        <span>
          v{__APP_VERSION__} · {__COMMIT__}
        </span>
      </footer>
      <Suspense fallback={null}>
        {aboutOpen && <About open onClose={() => setAboutOpen(false)} />}
        {debugOpen && <DebugPanel onClose={() => setDebugOpen(false)} />}
        {settingsOpen && <Settings />}
      </Suspense>
      <AudioOverlay ctx={runtime?.ctx ?? null} />
    </div>
  );
}
