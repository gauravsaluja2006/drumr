/**
 * Pad hit animation, kept outside React so a hit never causes a re-render (docs/03-DESIGN.md §4.1).
 * A hit is queued and applied on the next animation frame: sets --v (0..1), restarts the
 * data-hit animation, and bumps data-hit-count (used by e2e tests).
 */
const elements = new Map<number, HTMLElement>();
const pending = new Map<number, number>();
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

function flush(): void {
  scheduled = false;
  for (const [index, velocity] of pending) {
    const el = elements.get(index);
    if (!el) continue;
    el.style.setProperty('--v', (Math.max(0, Math.min(127, velocity)) / 127).toFixed(3));
    el.removeAttribute('data-hit');
    void el.offsetWidth; // restart the CSS animation
    el.setAttribute('data-hit', '');
    el.dataset.hitCount = String(Number(el.dataset.hitCount ?? '0') + 1);
  }
  pending.clear();
}
