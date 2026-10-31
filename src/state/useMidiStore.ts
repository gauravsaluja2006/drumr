import { create } from 'zustand';
import type { MidiManager } from '@/midi/MidiManager';
import type { MidiState } from '@/midi/types';

/** React-facing mirror of MidiManager state. The manager stays the source of truth. */
export const useMidiStore = create<MidiState>()(() => ({
  status: 'pending',
  inputs: [],
  selectedId: null,
  error: null,
  listening: false,
}));

export function bindMidiStore(manager: MidiManager): () => void {
  useMidiStore.setState(manager.getState(), true);
  return manager.subscribe((s) => useMidiStore.setState(s, true));
}
