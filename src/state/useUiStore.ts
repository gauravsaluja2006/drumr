import { create } from 'zustand';

interface UiState {
  editing: boolean;
  selectedPad: number | null;
  learning: boolean;
  setEditing: (on: boolean) => void;
  selectPad: (index: number | null) => void;
  setLearning: (on: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  editing: false,
  selectedPad: null,
  learning: false,
  setEditing: (on) => set({ editing: on, learning: false, selectedPad: on ? null : null }),
  selectPad: (index) => set({ selectedPad: index, learning: false }),
  setLearning: (on) => set({ learning: on }),
}));
