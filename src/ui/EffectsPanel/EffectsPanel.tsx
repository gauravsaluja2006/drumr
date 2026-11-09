import { useId } from 'react';
import { EFFECTS, type EffectId } from '@/engine/Effects';
import { useKitStore } from '@/state/useKitStore';
import { fxFor, useSettingsStore } from '@/state/useSettingsStore';
import { useUiStore } from '@/state/useUiStore';

export const EFFECT_LABELS: Record<EffectId, string> = {
  room: 'Room',
  hall: 'Hall',
  plate: 'Plate',
  echo: 'Echo',
};

const HINTS: Record<EffectId, string> = {
  room: 'Short, natural room around the kit',
  hall: 'Big, long concert-hall reverb',
  plate: 'Bright, dense studio plate (great on snare)',
  echo: 'Dotted-eighth echo at the tempo',
};

const CHIP =
  'flex items-center gap-1.5 rounded-m border border-line px-2.5 py-1 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0 aria-pressed:border-accent aria-pressed:text-accent';

function useEffectToggle(kitId: string, id: EffectId) {
  const setting = useSettingsStore((s) => fxFor(s, kitId)[id]);
  const setFx = useSettingsStore((s) => s.setFx);
  const toggle = () => setFx(kitId, id, { on: !setting.on, amount: setting.amount || 0.3 });
  return { setting, toggle };
}

function EffectChip({ id, kitId, title }: { id: EffectId; kitId: string; title: string }) {
  const { setting, toggle } = useEffectToggle(kitId, id);
  return (
    <button type="button" aria-pressed={setting.on} onClick={toggle} title={title} className={CHIP}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${setting.on ? 'bg-accent' : 'bg-bg-3'}`} />
      {EFFECT_LABELS[id]}
    </button>
  );
}

function EffectRow({ id, kitId }: { id: EffectId; kitId: string }) {
  const { setting } = useEffectToggle(kitId, id);
  const bpm = useSettingsStore((s) => s.rotation.bpm);
  const setFx = useSettingsStore((s) => s.setFx);
  const sliderId = useId();
  const pct = Math.round(setting.amount * 100);
  const label = EFFECT_LABELS[id];

  return (
    <div className="flex flex-col gap-1.5" data-effect={id}>
      <div className="flex items-center justify-between gap-2">
        <EffectChip id={id} kitId={kitId} title={id === 'echo' ? `${HINTS.echo} (${bpm} BPM)` : HINTS[id]} />
        <span className="flex-1 truncate text-xs text-fg-2">
          {id === 'echo' ? `${HINTS.echo} (${bpm} BPM)` : HINTS[id]}
        </span>
        <output htmlFor={sliderId} className={`font-mono text-xs ${setting.on ? 'text-fg-1' : 'text-fg-2'}`}>
          {pct}%
        </output>
      </div>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        aria-label={`${label} amount`}
        aria-valuetext={setting.on ? `${pct}%` : `off (${pct}%)`}
        onChange={(e) => {
          const amount = Number(e.target.value) / 100;
          setFx(kitId, id, { amount, on: amount > 0 });
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={`db-slider h-1.5 w-full cursor-pointer appearance-none rounded-full ${setting.on ? '' : 'opacity-50'}`}
        style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--bg-3) ${pct}%)` }}
      />
    </div>
  );
}

/** Where the current kit's effects come from, for the caption. */
function useFxSource(kitId: string): 'own' | 'shared' | 'recommended' {
  return useSettingsStore((s) => (s.fx[kitId] ? 'own' : s.fxDefault ? 'shared' : 'recommended'));
}

/**
 * Home-screen effects: one toggle per effect for the current kit, and a link to the full controls
 * in Settings (docs/03-DESIGN.md §4.5a).
 */
export function SoundQuick() {
  const kitId = useKitStore((s) => s.currentKitId);
  const openSettings = useUiStore((s) => s.openSettings);
  const source = useFxSource(kitId ?? '');
  if (!kitId) return <p className="text-xs text-fg-2">Load a kit to shape its sound.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {EFFECTS.map((id) => (
          <EffectChip key={id} id={id} kitId={kitId} title={HINTS[id]} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-fg-2">
        <span data-testid="fx-source">
          {source === 'own' ? 'Your mix' : source === 'shared' ? 'Same on every kit' : 'Recommended'}
        </span>
        <button
          type="button"
          onClick={() => openSettings('sound')}
          className="rounded-s px-1.5 py-0.5 text-fg-1 underline-offset-2 hover:text-fg-0 hover:underline"
        >
          Tune &amp; effects…
        </button>
      </div>
    </div>
  );
}

/**
 * Reverb and echo amounts for the current kit (Settings › Sound). Several can be on at once;
 * settings are remembered per kit, and "Use on all kits" makes them the default everywhere.
 */
export function EffectsPanel() {
  const kitId = useKitStore((s) => s.currentKitId);
  const kitName = useKitStore((s) => s.manifest?.name);
  const source = useFxSource(kitId ?? '');
  const applyFxToAll = useSettingsStore((s) => s.applyFxToAll);
  if (!kitId) return <p className="text-xs text-fg-2">Load a kit to add effects.</p>;

  return (
    <div className="flex flex-col gap-3.5">
      {EFFECTS.map((id) => (
        <EffectRow key={id} id={id} kitId={kitId} />
      ))}
      <div className="flex items-center justify-between gap-2 text-xs text-fg-2">
        <span>
          {source === 'own'
            ? `Saved for ${kitName ?? 'this kit'}`
            : source === 'shared'
              ? 'Same on every kit'
              : 'Recommended for this kit'}
        </span>
        {source === 'own' && (
          <button
            type="button"
            onClick={() => applyFxToAll(kitId)}
            className="rounded-m border border-line px-2 py-1 text-fg-1 hover:bg-bg-3 hover:text-fg-0"
          >
            Use on all kits
          </button>
        )}
      </div>
    </div>
  );
}
