import { useEffect, useState } from 'react';
import type { IAudioContext } from '@/engine/audioContext';

/**
 * Browsers start audio suspended until a user gesture. The overlay captures that first gesture,
 * asks the context to resume, and then gets out of the way even if resume() does not reach
 * "running" (e.g. no output device), so the app is never blocked behind it.
 */
export function AudioOverlay({ ctx }: { ctx: IAudioContext | null }) {
  const [dismissed, setDismissed] = useState(() => !ctx || ctx.state === 'running');

  useEffect(() => {
    if (!ctx || dismissed) return;
    const unlock = () => {
      setDismissed(true);
      void ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [ctx, dismissed]);

  if (dismissed) return null;
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
