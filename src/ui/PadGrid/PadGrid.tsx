import { GRID_COLS, GRID_ROWS } from './padLayout';
import { Pad } from './Pad';

export function PadGrid() {
  const pads = Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => i);
  return (
    <div
      role="group"
      aria-label="Drum pads"
      className="grid aspect-square w-full max-w-[min(100%,calc(100vh-220px))] gap-3"
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
    >
      {pads.map((i) => (
        <Pad key={i} index={i} />
      ))}
    </div>
  );
}
