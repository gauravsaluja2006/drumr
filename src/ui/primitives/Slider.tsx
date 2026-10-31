import { useId } from 'react';
import type React from 'react';

export function formatDb(db: number, min = -60): string {
  if (db <= min) return '−∞ dB';
  const sign = db > 0 ? '+' : db < 0 ? '−' : '';
  return `${sign}${Math.abs(db).toFixed(1)} dB`;
}

export interface DbSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  color?: string;
  /** Display and aria-valuetext formatter; defaults to dB. */
  format?: (value: number) => string;
  muted?: boolean;
  onMuteChange?: (muted: boolean) => void;
  onChange: (db: number) => void;
}

const BIG_STEP = 6;

/**
 * Horizontal dB slider (docs/03-DESIGN.md §4.4). Keyboard: arrows ±step, Page Up/Down ±6 dB,
 * Home/End min/max. Double-click resets to the default. Optional mute toggle.
 */
export function DbSlider({
  label,
  value,
  min = -60,
  max = 6,
  step = 0.5,
  defaultValue = 0,
  color,
  format,
  muted,
  onMuteChange,
  onChange,
}: DbSliderProps) {
  const show = format ?? ((v: number) => formatDb(v, min));
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const text = muted ? `muted (${show(value)})` : show(value);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const next: Record<string, number> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      PageUp: value + BIG_STEP,
      PageDown: value - BIG_STEP,
      Home: min,
      End: max,
    };
    const v = next[e.key];
    if (v === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(clamp(v));
  };

  return (
    <div className="group/slider flex flex-col gap-1.5" data-muted={muted || undefined}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-2 text-sm text-fg-1">
          {color && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: color }} />}
          {label}
        </label>
        <span className="flex items-center gap-2">
          {onMuteChange && (
            <button
              type="button"
              aria-pressed={!!muted}
              aria-label={`Mute ${label}`}
              onClick={() => onMuteChange(!muted)}
              className={`rounded-s border px-1.5 font-mono text-[10px] leading-4 ${
                muted
                  ? 'border-err/60 bg-err/15 text-fg-0'
                  : 'border-line text-fg-1 opacity-0 group-hover/slider:opacity-100 group-focus-within/slider:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100'
              }`}
            >
              M
            </button>
          )}
          <output
            htmlFor={id}
            className={`font-mono text-xs ${muted ? 'text-fg-2 line-through' : 'text-fg-1'}`}
          >
            {show(value)}
          </output>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={onKeyDown}
        onDoubleClick={() => onChange(defaultValue)}
        className={`db-slider h-1.5 w-full cursor-pointer appearance-none rounded-full ${muted ? 'opacity-50' : ''}`}
        style={{
          background: `linear-gradient(to right, ${color ?? 'var(--accent)'} ${pct}%, var(--bg-3) ${pct}%)`,
        }}
      />
    </div>
  );
}
