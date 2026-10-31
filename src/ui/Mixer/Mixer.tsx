import { DbSlider } from '@/ui/primitives/Slider';
import { MASTER_MAX_DB, MASTER_MIN_DB, useSettingsStore } from '@/state/useSettingsStore';

export function Mixer() {
  const masterDb = useSettingsStore((s) => s.masterDb);
  const setMasterDb = useSettingsStore((s) => s.setMasterDb);
  return (
    <div className="flex flex-col gap-4">
      <DbSlider
        label="Master"
        value={masterDb}
        min={MASTER_MIN_DB}
        max={MASTER_MAX_DB}
        onChange={setMasterDb}
      />
    </div>
  );
}
