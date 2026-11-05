import { DbSlider } from '@/ui/primitives/Slider';
import { DEFAULT_GROUP, MASTER_MAX_DB, MASTER_MIN_DB, useSettingsStore } from '@/state/useSettingsStore';
import { useKitStore } from '@/state/useKitStore';
import { GROUPS, type Group } from '@/kits/schema';

export const GROUP_LABELS: Record<Group, string> = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-hat',
  toms: 'Toms',
  cymbals: 'Cymbals',
  perc: 'Percussion',
};

/**
 * Master plus per-group gain and mute, remembered per kit (docs/03-DESIGN.md §4.4).
 * `strip` lays the faders out side by side, under the pads on desktop.
 */
export function Mixer({ layout = 'list' }: { layout?: 'list' | 'strip' }) {
  const masterDb = useSettingsStore((s) => s.masterDb);
  const setMasterDb = useSettingsStore((s) => s.setMasterDb);
  const kitId = useKitStore((s) => s.currentKitId);
  const kitGroups = useKitStore((s) => s.manifest?.groups);
  const mix = useSettingsStore((s) => (kitId ? s.mix[kitId] : undefined));
  const setGroup = useSettingsStore((s) => s.setGroup);
  const groups = GROUPS.filter((g) => !kitGroups || kitGroups.includes(g));
  const strip = layout === 'strip';
  const orientation = strip ? 'vertical' : 'horizontal';

  return (
    <div className={strip ? 'flex items-start justify-center gap-1' : 'flex flex-col gap-4'}>
      <DbSlider
        orientation={orientation}
        label="Master"
        value={masterDb}
        min={MASTER_MIN_DB}
        max={MASTER_MAX_DB}
        onChange={setMasterDb}
      />
      {kitId && (
        <div
          className={
            strip
              ? 'flex items-start gap-1 border-l border-line pl-1'
              : 'flex flex-col gap-3.5 border-t border-line pt-4'
          }
        >
          {groups.map((g) => {
            const s = mix?.[g] ?? DEFAULT_GROUP;
            return (
              <DbSlider
                key={g}
                orientation={orientation}
                label={GROUP_LABELS[g]}
                color={`var(--group-${g})`}
                value={s.db}
                muted={s.muted}
                min={MASTER_MIN_DB}
                max={MASTER_MAX_DB}
                onChange={(db) => setGroup(kitId, g, { db })}
                onMuteChange={(muted) => setGroup(kitId, g, { muted })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
