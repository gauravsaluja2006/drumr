import { useEffect, useId, useState } from 'react';
import { curve, exponentToSensitivity, sensitivityToExponent } from '@/engine/velocity';
import { useMappingStore } from '@/state/useMappingStore';
import { onHit } from '@/app/controller';
import { DbSlider } from '@/ui/primitives/Slider';

const DEFAULT_SENSITIVITY = exponentToSensitivity(2.4); // logic.js CURVE

/**
 * Pad feel (docs/03-DESIGN.md §4.6): Sensitivity (how much soft hits are lifted) and Hardest hit
 * (which input velocity counts as full force), a live curve plot with the last MIDI hit, and the
 * raw curve and floor numbers for fine-tuning.
 */
export function VelocityPanel() {
  const velocity = useMappingStore((s) => s.mapping.velocity);
  const setVelocity = useMappingStore((s) => s.setVelocity);
  const [last, setLast] = useState<{ x: number; y: number; key: number } | null>(null);
  const expId = useId();
  const floorId = useId();
  const ceiling = velocity.ceiling ?? 127;

  useEffect(() => {
    let frame = 0;
    let pending: { x: number; y: number } | null = null;
    const off = onHit((hit) => {
      if (hit.source !== 'midi') return;
      pending = { x: hit.inVelocity, y: hit.velocity };
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (pending) setLast({ ...pending, key: performance.now() });
        });
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, []);

  const points = Array.from({ length: 127 }, (_, i) => `${i + 1},${127 - curve(i + 1, velocity)}`).join(' ');
  const sensitivity = exponentToSensitivity(velocity.exponent);
  const hint =
    sensitivity >= 70 || ceiling <= 90
      ? 'Light touch: soft hits are lifted strongly.'
      : sensitivity <= 15 && ceiling >= 120
        ? 'Linear: you need to hit hard for full volume.'
        : 'Playing soft? Raise sensitivity or lower the hardest hit.';

  return (
    <div className="flex flex-col gap-4">
      <DbSlider
        label="Sensitivity"
        value={sensitivity}
        min={0}
        max={100}
        step={1}
        defaultValue={DEFAULT_SENSITIVITY}
        format={(v) => `${Math.round(v)}%`}
        onChange={(v) => setVelocity({ exponent: sensitivityToExponent(v) })}
      />
      <DbSlider
        label="Hardest hit"
        value={ceiling}
        min={32}
        max={127}
        step={1}
        defaultValue={127}
        format={(v) => `velocity ${Math.round(v)}`}
        onChange={(v) => setVelocity({ ceiling: Math.round(v) })}
      />
      <p className="text-xs text-fg-1" data-testid="velocity-hint">
        {hint}
      </p>
      <svg
        viewBox="0 0 128 128"
        role="img"
        aria-label="Velocity curve"
        className="aspect-[3/2] w-full rounded-m border border-line bg-bg-2"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1="127"
          x2="127"
          y2="0"
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {ceiling < 127 && (
          <line
            x1={ceiling}
            y1="0"
            x2={ceiling}
            y2="127"
            stroke="var(--fg-2)"
            strokeDasharray="3 3"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {last && (
          <circle
            key={last.key}
            className="velocity-dot"
            cx={last.x}
            cy={127 - last.y}
            r="4"
            fill="var(--accent-2)"
          />
        )}
      </svg>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <label htmlFor={expId} className="flex flex-col gap-1 text-fg-1">
          Curve
          <input
            id={expId}
            type="number"
            min={1}
            max={4}
            step={0.1}
            value={velocity.exponent}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 1 && v <= 4) setVelocity({ exponent: Math.round(v * 10) / 10 });
            }}
            className="rounded-s border border-line bg-bg-2 px-2 py-1 font-mono text-fg-0"
          />
        </label>
        <label htmlFor={floorId} className="flex flex-col gap-1 text-fg-1">
          Floor
          <input
            id={floorId}
            type="number"
            min={0}
            max={64}
            step={1}
            value={velocity.floor}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 0 && v <= 64) setVelocity({ floor: v });
            }}
            className="rounded-s border border-line bg-bg-2 px-2 py-1 font-mono text-fg-0"
          />
        </label>
      </div>
      {last && (
        <p className="font-mono text-xs text-fg-2">
          last hit {last.x} → {last.y}
        </p>
      )}
    </div>
  );
}
