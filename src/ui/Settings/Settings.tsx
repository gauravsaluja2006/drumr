import { useCallback, useId, type ReactNode } from 'react';
import { Dialog } from '@/ui/primitives/Dialog';
import { EffectsPanel } from '@/ui/EffectsPanel/EffectsPanel';
import { HiHatMeter } from '@/ui/HiHatMeter/HiHatMeter';
import { MidiControls } from '@/ui/MidiControls/MidiControls';
import { PresetSelect } from '@/ui/PresetSelect/PresetSelect';
import { VelocityPanel } from '@/ui/VelocityPanel/VelocityPanel';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useUiStore, type SettingsTab } from '@/state/useUiStore';
import { DrumTone } from './DrumTone';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'sound', label: 'Sound' },
  { id: 'playing', label: 'Playing' },
  { id: 'controller', label: 'Controller' },
];

const BUTTON = 'rounded-m border border-line px-3 py-1.5 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0';

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wider text-fg-2 uppercase">{title}</h3>
        {hint && <p className="text-xs text-fg-1">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function SoundTab() {
  const kitId = useKitStore((s) => s.currentKitId);
  const kitName = useKitStore((s) => s.manifest?.name);
  const humanize = useSettingsStore((s) => s.humanize);
  const setHumanize = useSettingsStore((s) => s.setHumanize);
  const resetKitSound = useSettingsStore((s) => s.resetKitSound);
  const customised = useSettingsStore((s) => !!kitId && (!!s.fx[kitId] || !!s.mix[kitId]));
  return (
    <>
      <p className="text-sm text-fg-1">
        Shaping <b className="text-fg-0">{kitName ?? 'the current kit'}</b>. Changes are saved for this kit
        only.
      </p>
      <Group title="Space" hint="Reverb and echo. Every kit starts with a little room and hall.">
        <EffectsPanel />
      </Group>
      <Group
        title="Drums"
        hint="Tune each drum up or down, and shorten how long it rings. Double-click to reset."
      >
        <DrumTone />
      </Group>
      <Group title="Feel">
        <label className="flex items-start gap-2 text-sm text-fg-1">
          <input
            type="checkbox"
            checked={humanize}
            onChange={(e) => setHumanize(e.target.checked)}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span>
            Natural variation
            <span className="block text-xs text-fg-2">
              Each hit varies a touch in level and pitch, like a real drum, so fast repeats never sound
              copy-pasted. Applies to every kit.
            </span>
          </span>
        </label>
      </Group>
      {kitId && (
        <button
          type="button"
          disabled={!customised}
          onClick={() => resetKitSound(kitId)}
          className={`${BUTTON} self-start disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Reset {kitName ?? 'this kit'} to its recommended sound
        </button>
      )}
    </>
  );
}

const SHORTCUTS: [string, string][] = [
  ['1 2 3 4 · Q W E R · A S D F · Z X C V', 'Play pads'],
  [',', 'Open settings'],
  ['M', 'Edit pad layout'],
  ['L', 'Loop: record / close / overdub'],
  ['Shift + L', 'Loop: stop / play'],
  ['`', 'Debug panel'],
];

function PlayingTab({ close }: { close: () => void }) {
  const setEditing = useUiStore((s) => s.setEditing);
  const loopLength = useSettingsStore((s) => s.loopLength);
  const setLoopLength = useSettingsStore((s) => s.setLoopLength);
  const bpm = useSettingsStore((s) => s.rotation.bpm);
  const loopId = useId();
  return (
    <>
      <Group title="Pad feel" hint="How hard you need to hit for full volume.">
        <VelocityPanel />
      </Group>
      <Group title="Hi-hat pedal" hint="The controller that opens and closes the hi-hat.">
        <HiHatMeter />
      </Group>
      <Group title="Pad layout">
        <div className="flex flex-wrap items-center gap-3">
          <PresetSelect />
          <button
            type="button"
            onClick={() => {
              close();
              setEditing(true);
            }}
            className={BUTTON}
          >
            Edit layout <span className="ml-1 font-mono text-fg-2">M</span>
          </button>
        </div>
      </Group>
      <Group title="Looper">
        <label htmlFor={loopId} className="flex items-center justify-between gap-3 text-sm text-fg-1">
          Loop length when you close it
          <select
            id={loopId}
            value={loopLength}
            onChange={(e) => setLoopLength(e.target.value as 'free' | 'bars')}
            className="rounded-m border border-line bg-bg-2 px-2 py-1 text-xs text-fg-0 hover:bg-bg-3"
          >
            <option value="free">As played</option>
            <option value="bars">Whole bars at {bpm} BPM</option>
          </select>
        </label>
      </Group>
      <Group title="Keyboard">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="contents">
              <dt className="font-mono text-fg-0">{keys}</dt>
              <dd className="text-fg-1">{what}</dd>
            </div>
          ))}
        </dl>
      </Group>
    </>
  );
}

/** Everything that is set once rather than played with (docs/03-DESIGN.md §4.11). */
export function Settings() {
  const tab = useUiStore((s) => s.settings);
  const openSettings = useUiStore((s) => s.openSettings);
  const base = useId();
  // Stable: the Dialog restores focus when onClose changes.
  const close = useCallback(() => openSettings(null), [openSettings]);
  if (!tab) return null;

  return (
    <Dialog open title="Settings" onClose={close}>
      <div role="tablist" aria-label="Settings sections" className="-mt-2 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`${base}-${t.id}-tab`}
            role="tab"
            type="button"
            aria-selected={t.id === tab}
            aria-controls={`${base}-${t.id}`}
            onClick={() => openSettings(t.id)}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-fg-1 hover:text-fg-0 aria-selected:border-accent aria-selected:text-fg-0"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        id={`${base}-${tab}`}
        role="tabpanel"
        aria-labelledby={`${base}-${tab}-tab`}
        className="flex flex-col gap-8"
      >
        {tab === 'sound' && <SoundTab />}
        {tab === 'playing' && <PlayingTab close={close} />}
        {tab === 'controller' && <MidiControls />}
      </div>
    </Dialog>
  );
}
