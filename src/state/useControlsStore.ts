import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ControlsConfigSchema,
  DEFAULT_CONTROLS,
  withBinding,
  type ControlAction,
  type ControlsConfig,
  type ControlSource,
} from '@/midi/controls';

interface ControlsState extends ControlsConfig {
  bind: (action: ControlAction, source: ControlSource | null) => void;
  set: (patch: Partial<Omit<ControlsConfig, 'bindings'>>) => void;
  reset: () => void;
}

/** Controller button/knob/encoder assignments (MIDI learn). Global, not per pad layout. */
export const useControlsStore = create<ControlsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_CONTROLS,
      bind: (action, source) => set({ bindings: withBinding(get().bindings, action, source) }),
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_CONTROLS),
    }),
    {
      name: 'drumr.v1.controls',
      version: 1,
      partialize: (s) => ({
        bindings: s.bindings,
        programChangeSelectsKit: s.programChangeSelectsKit,
        encoderMode: s.encoderMode,
      }),
      merge: (persisted, current) => {
        const parsed = ControlsConfigSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);
