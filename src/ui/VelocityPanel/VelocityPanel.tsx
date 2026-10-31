import { useEffect, useId, useState } from 'react';
import { curve } from '@/engine/velocity';
import { useMappingStore } from '@/state/useMappingStore';
import { onHit } from '@/app/controller';

/** Curve plot with the last MIDI hit, plus exponent and floor inputs (docs/03-DESIGN.md §4.6). */
export function VelocityPanel() {
  const velocity = useMappingStore((s) => s.mapping.velocity);
  const setVelocity = useMappingStore((s) => s.setVelocity);
  const [last, setLast] = useState<{ x: number; y: number; key: number } | null>(null);
  const expId = useId();
  const floorId = useId();

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

  return (
    <div className="flex flex-col gap-3">
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
