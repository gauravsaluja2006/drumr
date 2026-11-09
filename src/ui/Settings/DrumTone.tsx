import { GROUPS } from '@/kits/schema';
import { MIN_DECAY } from '@/engine/AudioEngine';
import { useKitStore } from '@/state/useKitStore';
import { DEFAULT_GROUP, useSettingsStore } from '@/state/useSettingsStore';
import { GROUP_LABELS } from '@/ui/Mixer/Mixer';
import { DbSlider } from '@/ui/primitives/Slider';

const semitones = (v: number) => (v === 0 ? '0 st' : `${v > 0 ? '+' : '−'}${Math.abs(v)} st`);
const lengthText = (v: number) => (v >= 100 ? 'Natural' : `${Math.round(v)}%`);

/**
 * Tune and length per drum group for the current kit (docs/03-DESIGN.md §4.11). Double-click a
 * slider to reset it.
 */
export function DrumTone() {
  const kitId = useKitStore((s) => s.currentKitId);
  const kitGroups = useKitStore((s) => s.manifest?.groups);
  const mix = useSettingsStore((s) => (kitId ? s.mix[kitId] : undefined));
  const setGroup = useSettingsStore((s) => s.setGroup);
  if (!kitId) return null;
  const groups = GROUPS.filter((g) => !kitGroups || kitGroups.includes(g));

  return (
    <ul className="flex flex-col divide-y divide-line">
      {groups.map((g) => {
        const s = mix?.[g] ?? DEFAULT_GROUP;
        return (
          <li key={g} className="grid grid-cols-1 gap-x-6 gap-y-3 py-3 sm:grid-cols-2">
            <DbSlider
              label={`${GROUP_LABELS[g]} tune`}
              value={s.tune ?? 0}
              min={-12}
              max={12}
              step={1}
              color={`var(--group-${g})`}
              format={semitones}
              onChange={(tune) => setGroup(kitId, g, { tune })}
            />
            <DbSlider
              label={`${GROUP_LABELS[g]} length`}
              value={Math.round((s.decay ?? 1) * 100)}
              min={MIN_DECAY * 100}
              max={100}
              step={5}
              defaultValue={100}
              color={`var(--group-${g})`}
              format={lengthText}
              onChange={(pct) => setGroup(kitId, g, { decay: pct / 100 })}
            />
          </li>
        );
      })}
    </ul>
  );
}
