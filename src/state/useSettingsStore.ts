import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Group } from '@/kits/schema';

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
    { name: 'drumr.v1.settings', version: 1 },
  ),
);
