/**
 * TEMPORARY Phase 1 pad → voice wiring for the test kit. Replaced by the mapping store in Phase 3.
 * Pad 0 is the top-left pad (keyboard "1").
 */
export interface TempPad {
  voice: string;
  label: string;
}

const CYCLE: TempPad[] = [
  { voice: 'kick', label: 'Kick' },
  { voice: 'snare.center', label: 'Snare' },
  { voice: 'hihat.closed', label: 'HH Closed' },
  { voice: 'hihat.open', label: 'HH Open' },
];

export const TEMP_PADS: readonly TempPad[] = Array.from(
  { length: 16 },
  (_, i) => CYCLE[i % CYCLE.length] as TempPad,
);
