import { GRID_COLS, GRID_ROWS } from './padLayout';
import { Pad } from './Pad';
import type { Group } from '@/kits/schema';

export interface PadView {
  label?: string;
  note?: number;
  unavailable?: boolean;
  /** Drum group of the sound the pad plays now; colours the dot and the hit flash. */
  group?: Group;
}

export interface PadGridProps {
  pads?: readonly PadView[];
  disabled?: boolean;
  selectedIndex?: number | null;
  learning?: boolean;
  onHit?: (index: number, velocity: number, eventTime: number) => void;
}

export function PadGrid({
  pads = [],
  disabled,
  selectedIndex = null,
  learning = false,
  onHit,
}: PadGridProps) {
  return (
    <div
      role="group"
      aria-label="Drum pads"
      className="grid aspect-square w-full max-w-[min(100%,calc(100vh-var(--grid-reserve,220px)))] gap-3"
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, i) => (
        <Pad
          key={i}
          index={i}
          {...pads[i]}
          disabled={disabled}
          selected={selectedIndex === i}
          learning={learning && selectedIndex === i}
          onHit={onHit}
        />
      ))}
    </div>
  );
}
