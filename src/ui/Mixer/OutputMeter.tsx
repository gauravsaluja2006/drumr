import { useEffect, useRef } from 'react';
import { getRuntime } from '@/app/runtime';

const FLOOR_DB = -48;
/** Fall rate of the bar: 24 dB per second, like a hardware peak meter. */
const FALL_DB_PER_S = 24;
const CLIP = 0.98;
const CLIP_HOLD_MS = 1500;

export const peakToLevel = (peak: number): number =>
  peak <= 0 ? 0 : Math.min(1, Math.max(0, (20 * Math.log10(peak) - FLOOR_DB) / -FLOOR_DB));

/**
 * Output peak meter beside the master fader (docs/03-DESIGN.md §4.4): green → amber → red, with a
 * clip light that holds for 1.5 s. Drawn per frame on DOM nodes, never through React state, and
 * only while something sounds: the first hit wakes it, it sleeps again once everything settles.
 */
export function OutputMeter() {
  const cover = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let engine: ReturnType<typeof getRuntime>['engine'];
    try {
      engine = getRuntime().engine;
    } catch {
      return;
    }
    let frame = 0;
    let shown = 0;
    let drawn = -1;
    let clipShown = false;
    let last = 0;
    let clipUntil = 0;
    const draw = (now: number) => {
      frame = 0;
      const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
      last = now;
      const active = engine.isActive();
      const peak = active ? engine.outputPeak() : 0;
      shown = Math.max(peakToLevel(peak), shown - (FALL_DB_PER_S * dt) / -FLOOR_DB);
      if (peak >= CLIP) clipUntil = now + CLIP_HOLD_MS;
      // Touch the DOM only when something visible changed.
      if (Math.abs(shown - drawn) > 0.004 && cover.current) {
        cover.current.style.transform = `scaleY(${(1 - shown).toFixed(3)})`;
        drawn = shown;
      }
      const clipOn = now < clipUntil;
      if (clipOn !== clipShown) {
        clip.current?.toggleAttribute('data-on', clipOn);
        clipShown = clipOn;
      }
      // Sleep once the sound, the bar and the clip light have all settled; the next hit wakes it.
      if (active || shown > 0 || clipOn) frame = requestAnimationFrame(draw);
      else last = 0;
    };
    const off = engine.onTrigger(() => {
      if (!frame) frame = requestAnimationFrame(draw);
    });
    return () => {
      off();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2" aria-hidden="true" title="Output level">
      <span
        ref={clip}
        className="size-1.5 rounded-full bg-bg-3 data-[on]:bg-err data-[on]:shadow-[0_0_6px_var(--err)]"
      />
      <div
        className="relative h-20 w-1.5 overflow-hidden rounded-full [@media(max-height:800px)]:h-10"
        style={{ background: 'linear-gradient(to top, var(--ok) 0 70%, var(--warn) 70% 88%, var(--err) 88%)' }}
      >
        <div ref={cover} className="absolute inset-0 origin-top bg-bg-3" style={{ transform: 'scaleY(1)' }} />
      </div>
    </div>
  );
}
