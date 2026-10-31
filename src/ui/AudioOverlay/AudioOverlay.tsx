import { useEffect, useState } from 'react';
import type { IAudioContext } from '@/engine/audioContext';

/** Browsers start audio suspended until a user gesture. Covers the app until audio runs. */
export function AudioOverlay({ ctx }: { ctx: IAudioContext | null }) {
  const [running, setRunning] = useState(() => ctx?.state === 'running');

  useEffect(() => {
    if (!ctx || ctx.state === 'running') return;
    const unlock = () => {
      void ctx.resume().then(() => setRunning(ctx.state === 'running'));
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [ctx]);

  if (running || !ctx) return null;
  return (
    <div
      data-testid="audio-overlay"
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-bg-0/85 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="size-3 animate-pulse rounded-full bg-accent shadow-[0_0_24px_var(--accent)]"
        />
        <p className="text-xl font-semibold">Tap anywhere to start audio</p>
        <p className="text-fg-1">Browsers keep sound off until you interact with the page.</p>
      </div>
    </div>
  );
}
