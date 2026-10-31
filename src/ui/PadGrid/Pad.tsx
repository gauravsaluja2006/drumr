import { keyHintFor } from './padLayout';

export interface PadProps {
  index: number;
  label?: string;
  note?: number;
}

/**
 * The accessible name is built from visible text plus screen-reader-only text
 * ("Pad 5: Snare center, note 25") so it always contains what sighted users see.
 */
export function Pad({ index, label, note }: PadProps) {
  return (
    <button
      type="button"
      data-pad={index}
      className="pad group relative aspect-square min-h-11 rounded-m border border-line bg-bg-2 p-3 text-left transition-colors hover:bg-bg-3"
      style={{ boxShadow: 'var(--shadow-pad)' }}
    >
      <span className="absolute top-3 left-3 text-sm font-medium text-fg-1">
        <span className="sr-only">Pad {index + 1}: </span>
        {label ?? <span className="text-fg-2">{index + 1}</span>}
        {label === undefined && <span className="sr-only"> unassigned</span>}
      </span>
      {note !== undefined && (
        <span className="absolute bottom-3 left-3 font-mono text-xs text-fg-2">
          <span className="sr-only">, note </span>
          {note}
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute right-3 bottom-3 hidden font-mono text-[11px] text-fg-2 lg:inline"
      >
        {keyHintFor(index)}
      </span>
    </button>
  );
}
