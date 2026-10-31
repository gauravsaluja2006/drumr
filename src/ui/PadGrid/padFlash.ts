/**
 * Pad hit animation, kept outside React so a hit never causes a re-render (docs/03-DESIGN.md §4.1).
 * A hit is queued and applied on the next animation frame: sets --v (0..1), restarts the
 * data-hit animation, and bumps data-hit-count (used by e2e tests).
 */
import { prefersReducedMotion } from '@/app/media';

const elements = new Map<number, HTMLElement>();
const pending = new Map<number, number>();
const ringing = new Map<number, boolean>();
let scheduled = false;

const clearHit = (e: Event) => {
  if (e.target === e.currentTarget) (e.currentTarget as HTMLElement).removeAttribute('data-hit');
};

export function registerPad(index: number, el: HTMLElement | null): void {
  const previous = elements.get(index);
  if (previous === el) return;
  previous?.removeEventListener('animationend', clearHit);
  if (el) {
    el.addEventListener('animationend', clearHit);
    elements.set(index, el);
  } else {
    elements.delete(index);
  }
}

export function flashPad(index: number, velocity: number): void {
  pending.set(index, velocity);
  if (scheduled) return;
  scheduled = true;
  globalThis.requestAnimationFrame(flush);
}

/** Marks a pad whose open hi-hat is still sounding (thin ring, cleared on choke or end). */
export function ringPad(index: number, on: boolean): void {
  ringing.set(index, on);
  if (scheduled) return;
  scheduled = true;
  globalThis.requestAnimationFrame(flush);
}

/** Applies queued updates now. For tests; the app always flushes on animation frames. */
export function flushPadFlash(): void {
  flush();
}

function flush(): void {
  scheduled = false;
  for (const [index, on] of ringing) elements.get(index)?.toggleAttribute('data-ringing', on);
  ringing.clear();
  for (const [index, velocity] of pending) {
    const el = elements.get(index);
    if (!el) continue;
    el.style.setProperty('--v', (Math.max(0, Math.min(127, velocity)) / 127).toFixed(3));
    // Restart the animation by alternating between two identical keyframe names ("a"/"b"), which
    // avoids forcing a synchronous layout (reading offsetWidth) on every hit.
    // Reduced motion: a one-frame colour change, no glow or scale (docs/03-DESIGN.md §5).
    const phase = el.getAttribute('data-hit')?.endsWith('a') ? 'b' : 'a';
    el.setAttribute('data-hit', prefersReducedMotion() ? `reduced-${phase}` : phase);
    el.dataset.hitCount = String(Number(el.dataset.hitCount ?? '0') + 1);
  }
  pending.clear();
}
