import { useId } from 'react';
import { BUILTIN_PRESETS } from '@/mapping/presets';
import { useMappingStore } from '@/state/useMappingStore';

export function PresetSelect() {
  const id = useId();
  const presetId = useMappingStore((s) => s.presetId);
  const customPresets = useMappingStore((s) => s.customPresets);
  const setPreset = useMappingStore((s) => s.setPreset);
  return (
    <div className="flex items-center gap-2 text-xs">
      <label htmlFor={id} className="text-fg-2">
        Layout
      </label>
      <select
        id={id}
        value={presetId}
        onChange={(e) => setPreset(e.target.value)}
        className="max-w-64 rounded-m border border-line bg-bg-2 px-2 py-1.5 text-fg-0 hover:bg-bg-3"
      >
        <optgroup label="Built-in">
          {BUILTIN_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.mapping.name}
            </option>
          ))}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label="My layouts">
            {customPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.mapping.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
