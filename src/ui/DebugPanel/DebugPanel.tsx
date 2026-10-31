import { useEffect, useState } from 'react';
import { getRuntime } from '@/app/runtime';

interface Snapshot {
  rows: [string, string][];
}

function snapshot(): Snapshot {
  const { ctx, engine, sampler } = getRuntime();
  const s = engine.stats();
  const ms = (sec: number | undefined) => (sec === undefined ? 'n/a' : `${(sec * 1000).toFixed(1)} ms`);
  return {
    rows: [
      ['audio', `${ctx.state} · ${ctx.sampleRate} Hz`],
      ['base latency', ms(ctx.baseLatency)],
      ['output latency', ms(ctx.outputLatency)],
      [
        'event→schedule',
        `median ${s.latency.median.toFixed(2)} ms · p95 ${s.latency.p95.toFixed(2)} ms (${s.latency.samples})`,
      ],
      ['voices', `${s.activeVoices} active · ${s.triggers} hits · ${s.steals} stolen · ${s.chokes} choked`],
      ['limiter', `${engine.limiter.reduction.toFixed(1)} dB reduction`],
      [
        'buffers',
        `${engine.currentKit?.buffers.size ?? 0} decoded · kits resident: ${sampler.residentKitIds.join(', ') || '—'}`,
      ],
    ],
  };
}

/** Developer readout (docs/03-DESIGN.md §4.9). Toggle with the ` key or the footer link. */
export function DebugPanel({ onClose }: { onClose: () => void }) {
  const [snap, setSnap] = useState<Snapshot>(snapshot);
  useEffect(() => {
    const id = setInterval(() => setSnap(snapshot()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <section
      aria-label="Debug"
      data-testid="debug-panel"
      className="fixed right-4 bottom-12 z-40 w-[22rem] rounded-l border border-line bg-bg-1/95 p-4 font-mono text-[11px] text-fg-1 shadow-2xl backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-fg-0 uppercase">Debug</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close debug panel"
          className="rounded-s px-1.5 hover:bg-bg-3"
        >
          ✕
        </button>
      </div>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-1">
        {snap.rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-2">{k}</dt>
            <dd data-key={k} className="text-fg-0">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
