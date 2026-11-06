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
  /** Vertical renders a mixing-desk fader: value on top, label and mute below. */
  orientation?: 'horizontal' | 'vertical';
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
  orientation = 'horizontal',
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

  const muteButton = onMuteChange && (
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
  );
  const valueText = (
    <output htmlFor={id} className={`font-mono text-xs ${muted ? 'text-fg-2 line-through' : 'text-fg-1'}`}>
      {show(value)}
    </output>
  );
  const labelEl = (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-fg-1">
      {color && (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      )}
      {label}
    </label>
  );
  const vertical = orientation === 'vertical';
  const input = (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-valuetext={text}
      aria-orientation={vertical ? 'vertical' : undefined}
      onChange={(e) => onChange(Number(e.target.value))}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onChange(defaultValue)}
      className={`db-slider cursor-pointer appearance-none rounded-full ${
        vertical
          ? 'h-20 w-1.5 [direction:rtl] [writing-mode:vertical-lr] [@media(max-height:800px)]:h-10'
          : 'h-1.5 w-full'
      } ${muted ? 'opacity-50' : ''}`}
      style={{
        background: `linear-gradient(to ${vertical ? 'top' : 'right'}, ${color ?? 'var(--accent)'} ${pct}%, var(--bg-3) ${pct}%)`,
      }}
    />
  );

  if (vertical)
    return (
      <div
        className="group/slider flex w-[4.5rem] flex-col items-center gap-2 [&_output]:text-[10px]"
        data-muted={muted || undefined}
      >
        {valueText}
        {input}
        <div className="flex h-5 items-center">{muteButton}</div>
        <div className="[&_label]:gap-1.5 [&_label]:text-xs">{labelEl}</div>
      </div>
    );

  return (
    <div className="group/slider flex flex-col gap-1.5" data-muted={muted || undefined}>
      <div className="flex items-center justify-between gap-2">
        {labelEl}
        <span className="flex items-center gap-2">
          {muteButton}
          {valueText}
        </span>
      </div>
      {input}
    </div>
  );
}
