import type React from 'react';
import { keyHintFor } from './padLayout';
import { registerPad } from './padFlash';
import { velocityFromPosition } from '@/input/pointer';
import { KEYBOARD_VELOCITY } from '@/input/keyboard';

export interface PadProps {
  index: number;
  label?: string;
  note?: number;
  disabled?: boolean;
  unavailable?: boolean;
  selected?: boolean;
  learning?: boolean;
  onHit?: (index: number, velocity: number, eventTime: number) => void;
}

/**
 * The accessible name is built from visible text plus screen-reader-only text
 * ("Pad 5: Snare, note 25") so it always contains what sighted users see.
 */
export function Pad({ index, label, note, disabled, unavailable, selected, learning, onHit }: PadProps) {
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button > 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onHit?.(index, velocityFromPosition(e.clientY - rect.top, rect.height), performance.now());
  };
  // Pointer hits are handled on pointerdown for latency; click with detail 0 is keyboard activation.
  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0 && !disabled) onHit?.(index, KEYBOARD_VELOCITY, performance.now());
  };

  return (
    <button
      ref={(el) => registerPad(index, el)}
      type="button"
      data-pad={index}
      data-unavailable={unavailable || undefined}
      data-selected={selected || undefined}
      data-learning={learning || undefined}
      aria-current={selected || undefined}
      disabled={disabled}
      title={unavailable ? 'Not in this kit' : undefined}
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="pad relative aspect-square min-h-11 touch-manipulation rounded-m border border-line bg-bg-2 p-3 text-left transition-[background-color,opacity] select-none hover:bg-bg-3 disabled:cursor-wait disabled:bg-bg-1 disabled:hover:bg-bg-1"
    >
      <span className="pad-label absolute top-3 left-3 z-10 text-sm font-medium text-fg-0">
        <span className="sr-only">{`Pad ${index + 1}:`}</span>{' '}
        {label ?? <span className="text-fg-2">{index + 1}</span>}
        {label === undefined && (
          <>
            {' '}
            <span className="sr-only">unassigned</span>
          </>
        )}
        {learning && (
          <>
            {' '}
            <span className="pad-learning-hint text-xs text-accent">Hit a pad…</span>
          </>
        )}
        {unavailable && (
          <>
            {' '}
            <span className="sr-only">(not in this kit)</span>
          </>
        )}
      </span>
      {note !== undefined && (
        <span className="absolute bottom-3 left-3 z-10 font-mono text-xs text-fg-2">
          <span className="sr-only">, note</span> {note}
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute right-3 bottom-3 z-10 hidden font-mono text-[11px] text-fg-2 lg:inline"
      >
        {keyHintFor(index)}
      </span>
    </button>
  );
}
