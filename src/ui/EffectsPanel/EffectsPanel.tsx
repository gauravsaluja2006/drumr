import { useId } from 'react';
import { EFFECTS, type EffectId } from '@/engine/Effects';
import { useKitStore } from '@/state/useKitStore';
import { fxFor, useSettingsStore } from '@/state/useSettingsStore';

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

function EffectRow({ id, kitId }: { id: EffectId; kitId: string }) {
  const setting = useSettingsStore((s) => fxFor(s, kitId)[id]);
  const bpm = useSettingsStore((s) => s.rotation.bpm);
  const setFx = useSettingsStore((s) => s.setFx);
  const sliderId = useId();
  const pct = Math.round(setting.amount * 100);
  const label = EFFECT_LABELS[id];

  return (
    <div className="flex flex-col gap-1.5" data-effect={id}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={setting.on}
          onClick={() => setFx(kitId, id, { on: !setting.on, amount: setting.amount || 0.3 })}
          title={id === 'echo' ? `${HINTS.echo} (${bpm} BPM)` : HINTS[id]}
          className="flex items-center gap-1.5 rounded-m border border-line px-2.5 py-1 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0 aria-pressed:border-accent aria-pressed:text-accent"
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${setting.on ? 'bg-accent' : 'bg-bg-3'}`}
          />
          {label}
        </button>
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

/**
 * Reverb and echo for the current kit (docs/03-DESIGN.md §4.6a). Several can be on at once;
 * settings are remembered per kit, and "Use on all kits" makes them the default everywhere.
 */
export function EffectsPanel() {
  const kitId = useKitStore((s) => s.currentKitId);
  const kitName = useKitStore((s) => s.manifest?.name);
  const ownSettings = useSettingsStore((s) => !!kitId && !!s.fx[kitId]);
  const applyFxToAll = useSettingsStore((s) => s.applyFxToAll);
  if (!kitId) return <p className="text-xs text-fg-2">Load a kit to add effects.</p>;

  return (
    <div className="flex flex-col gap-3.5">
      {EFFECTS.map((id) => (
        <EffectRow key={id} id={id} kitId={kitId} />
      ))}
      <div className="flex items-center justify-between gap-2 text-xs text-fg-2">
        <span>{ownSettings ? `Saved for ${kitName ?? 'this kit'}` : 'Same on every kit'}</span>
        {ownSettings && (
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
