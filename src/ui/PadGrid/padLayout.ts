/** Keyboard keys for a 4x4 grid, top row first, left to right (docs/01-PRD.md US-02). */
export const KEYBOARD_ROWS = ['1234', 'qwer', 'asdf', 'zxcv'] as const;

export const GRID_ROWS = 4;
export const GRID_COLS = 4;

export function keyHintFor(index: number): string {
  const row = KEYBOARD_ROWS[Math.floor(index / GRID_COLS)];
  return row?.[index % GRID_COLS]?.toUpperCase() ?? '';
}
