import { useId } from 'react';

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
  onChange: (db: number) => void;
}

/** Horizontal dB slider (docs/03-DESIGN.md §4.4). Double-click resets to the default. */
export function DbSlider({
  label,
  value,
  min = -60,
  max = 6,
  step = 0.5,
  defaultValue = 0,
  color,
  onChange,
}: DbSliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="flex items-center gap-2 text-sm text-fg-1">
          {color && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: color }} />}
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-xs text-fg-1">
          {formatDb(value, min)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={formatDb(value, min)}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(defaultValue)}
        className="db-slider h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: `linear-gradient(to right, var(--accent) ${pct}%, var(--bg-3) ${pct}%)` }}
      />
    </div>
  );
}
