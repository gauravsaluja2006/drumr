import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Group } from '@/kits/schema';
import { DEFAULT_ROTATION, MAX_BPM, MIN_BPM, type RotationSettings } from '@/kits/rotation';

export const MASTER_MIN_DB = -60;
export const MASTER_MAX_DB = 6;

export interface GroupSetting {
  db: number;
  muted: boolean;
}
export const DEFAULT_GROUP: GroupSetting = { db: 0, muted: false };
type KitMix = Partial<Record<Group, GroupSetting>>;

interface SettingsState {
  masterDb: number;
  lastKitId: string | null;
  /** Per-kit group mix: kit id → group → gain and mute (docs/04-ROADMAP.md Phase 6). */
  mix: Record<string, KitMix>;
  /** Kit rotation settings (whether it is running is not persisted). */
  rotation: RotationSettings;
  setRotation: (patch: Partial<RotationSettings>) => void;
  setMasterDb: (db: number) => void;
  setGroup: (kitId: string, group: Group, patch: Partial<GroupSetting>) => void;
  setLastKitId: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterDb: 0,
      lastKitId: null,
      mix: {},
      rotation: DEFAULT_ROTATION,
      setRotation: (patch) =>
        set((s) => {
          const next = { ...s.rotation, ...patch };
          next.bpm = Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, next.bpm)));
          return { rotation: next };
        }),
      setGroup: (kitId, group, patch) =>
        set((s) => {
          const current = s.mix[kitId]?.[group] ?? DEFAULT_GROUP;
          const next = { ...current, ...patch };
          next.db = Math.min(MASTER_MAX_DB, Math.max(MASTER_MIN_DB, next.db));
          return { mix: { ...s.mix, [kitId]: { ...s.mix[kitId], [group]: next } } };
        }),
      setMasterDb: (db) => set({ masterDb: Math.min(MASTER_MAX_DB, Math.max(MASTER_MIN_DB, db)) }),
      setLastKitId: (id) => set({ lastKitId: id }),
    }),
    {
      name: 'drumr.v1.settings',
      version: 1,
      // Settings saved before rotation existed get the defaults for the new fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return { ...current, ...p, rotation: { ...DEFAULT_ROTATION, ...p.rotation } };
      },
    },
  ),
);
