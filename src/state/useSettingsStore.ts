import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MASTER_MIN_DB = -60;
export const MASTER_MAX_DB = 6;

interface SettingsState {
  masterDb: number;
  lastKitId: string | null;
  setMasterDb: (db: number) => void;
  setLastKitId: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterDb: 0,
      lastKitId: null,
      setMasterDb: (db) => set({ masterDb: Math.min(MASTER_MAX_DB, Math.max(MASTER_MIN_DB, db)) }),
      setLastKitId: (id) => set({ lastKitId: id }),
    }),
    { name: 'drumr.v1.settings', version: 1 },
  ),
);
