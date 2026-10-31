import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILTIN_PRESETS, DEFAULT_PRESET_ID } from '@/mapping/presets';
import { mappingSchema, type Mapping } from '@/mapping/schema';

interface MappingState {
  presetId: string;
  mapping: Mapping;
  setPreset: (id: string) => void;
  setVelocity: (v: Partial<Mapping['velocity']>) => void;
  setHihat: (h: Partial<Mapping['hihat']>) => void;
}

const preset = (id: string) => (BUILTIN_PRESETS.find((p) => p.id === id) ?? BUILTIN_PRESETS[0]!).mapping;

export const useMappingStore = create<MappingState>()(
  persist(
    (set, get) => ({
      presetId: DEFAULT_PRESET_ID,
      mapping: preset(DEFAULT_PRESET_ID),
      setPreset: (id) => set({ presetId: id, mapping: preset(id) }),
      setVelocity: (v) =>
        set({ mapping: { ...get().mapping, velocity: { ...get().mapping.velocity, ...v } } }),
      setHihat: (h) => set({ mapping: { ...get().mapping, hihat: { ...get().mapping.hihat, ...h } } }),
    }),
    {
      name: 'drumr.v1.mapping',
      version: 1,
      partialize: (s) => ({ presetId: s.presetId, mapping: s.mapping }),
      // Never trust persisted data blindly: fall back to the preset if it no longer validates.
      merge: (persisted, current) => {
        const p = persisted as Partial<MappingState> | undefined;
        const parsed = mappingSchema.safeParse(p?.mapping);
        return parsed.success
          ? { ...current, presetId: p?.presetId ?? current.presetId, mapping: parsed.data }
          : current;
      },
    },
  ),
);
