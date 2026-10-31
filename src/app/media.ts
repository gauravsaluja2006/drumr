import { useSyncExternalStore } from 'react';

function query(q: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(q)
    : null;
}

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
export const DESKTOP = '(min-width: 1024px)';

export function prefersReducedMotion(): boolean {
  return query(REDUCED_MOTION)?.matches ?? false;
}

/** Subscribes to a media query. Without matchMedia (jsdom) it reports `fallback`. */
export function useMediaQuery(q: string, fallback: boolean): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = query(q);
      mql?.addEventListener('change', cb);
      return () => mql?.removeEventListener('change', cb);
    },
    () => query(q)?.matches ?? fallback,
    () => fallback,
  );
}
