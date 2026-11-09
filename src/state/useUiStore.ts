import { create } from 'zustand';

export type SettingsTab = 'sound' | 'playing' | 'controller';

interface UiState {
  /** Open settings tab; null = closed. */
  settings: SettingsTab | null;
  openSettings: (tab: SettingsTab | null) => void;
  editing: boolean;
  selectedPad: number | null;
  learning: boolean;
  /** Kit highlighted by the controller encoder, loaded by the encoder's push; null = none. */
  kitCursor: string | null;
  setKitCursor: (id: string | null) => void;
  setEditing: (on: boolean) => void;
  selectPad: (index: number | null) => void;
  setLearning: (on: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  settings: null,
  openSettings: (tab) => set({ settings: tab }),
  editing: false,
  selectedPad: null,
  learning: false,
  kitCursor: null,
  setKitCursor: (id) => set({ kitCursor: id }),
  setEditing: (on) => set({ editing: on, learning: false, selectedPad: on ? null : null }),
  selectPad: (index) => set({ selectedPad: index, learning: false }),
  setLearning: (on) => set({ learning: on }),
}));
