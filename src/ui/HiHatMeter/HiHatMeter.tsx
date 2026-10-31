import { useEffect, useId, useState } from 'react';
import { BANDS } from '@/engine/HiHat';
import { currentHihatArticulation, hihat, onHihatChange } from '@/app/controller';
import { useMappingStore } from '@/state/useMappingStore';
import { useKitStore } from '@/state/useKitStore';

const LEVEL_NAMES: Record<string, string> = {
  'hihat.closed': 'Closed',
  'hihat.loose': 'Loose',
  'hihat.quarter': '¼ open',
  'hihat.half': 'Half open',
  'hihat.threeQuarter': '¾ open',
  'hihat.open': 'Open',
};

const CC_OPTIONS: [number, string][] = [
  [1, 'Mod wheel / strip'],
  [2, 'Breath'],
  [4, 'Foot controller'],
  [11, 'Expression'],
  [64, 'Sustain pedal'],
];

/** Vertical openness meter and hi-hat CC settings (docs/03-DESIGN.md §4.5). */
export function HiHatMeter() {
  const settings = useMappingStore((s) => s.mapping.hihat);
  const setHihat = useMappingStore((s) => s.setHihat);
  // Re-render when the kit (and therefore its openness levels) changes.
  useKitStore((s) => s.available);
  const [value, setValue] = useState<number | null>(hihat.value);
  const ccId = useId();

  useEffect(() => {
    let frame = 0;
    const off = onHihatChange(() => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          setValue(hihat.value);
        });
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, []);

  const band = hihat.band(settings.invert);
  const level = currentHihatArticulation();
  const options = CC_OPTIONS.some(([cc]) => cc === settings.cc)
    ? CC_OPTIONS
    : [...CC_OPTIONS, [settings.cc, `CC ${settings.cc}`] as [number, string]];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-stretch gap-4">
        <div
          role="meter"
          aria-label="Hi-hat openness"
          aria-valuemin={0}
          aria-valuemax={BANDS - 1}
          aria-valuenow={band}
          aria-valuetext={level ? (LEVEL_NAMES[level] ?? level) : 'Not in this kit'}
          className="flex h-32 w-5 flex-col-reverse gap-1"
        >
          {Array.from({ length: BANDS }, (_, i) => (
            <span key={i} className={`flex-1 rounded-[3px] ${i <= band ? 'bg-group-hihat' : 'bg-bg-3'}`} />
          ))}
        </div>
        <div className="flex flex-col justify-between">
          <p className="text-base font-medium text-fg-0" data-testid="hihat-level">
            {level ? (LEVEL_NAMES[level] ?? level) : '—'}
          </p>
          <p className="font-mono text-xs text-fg-1">
            {value === null ? 'no CC yet' : `CC ${settings.cc} = ${value}`}
          </p>
        </div>
      </div>
      <label htmlFor={ccId} className="flex flex-col gap-1 text-xs text-fg-1">
        Controller
        <select
          id={ccId}
          value={settings.cc}
          onChange={(e) => setHihat({ cc: Number(e.target.value) })}
          className="rounded-s border border-line bg-bg-2 px-2 py-1 text-fg-0"
        >
          {options.map(([cc, name]) => (
            <option key={cc} value={cc}>
              CC {cc} · {name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-fg-1">
        <input
          type="checkbox"
          checked={settings.invert}
          onChange={(e) => setHihat({ invert: e.target.checked })}
          className="accent-[var(--accent)]"
        />
        High value opens the hat
      </label>
      <label className="flex items-center gap-2 text-xs text-fg-1">
        <input
          type="checkbox"
          checked={settings.pedalOnClose}
          onChange={(e) => setHihat({ pedalOnClose: e.target.checked })}
          className="accent-[var(--accent)]"
        />
        Pedal “chick” when fully closed
      </label>
    </div>
  );
}
