import { clamp } from '@/lib/audioMath';

/** Velocity from where the pad was hit: top edge 60, bottom edge 127 (docs/02-ARCHITECTURE.md §5). */
export function velocityFromPosition(offsetY: number, height: number): number {
  if (height <= 0) return 100;
  return Math.round(60 + 67 * clamp(offsetY / height, 0, 1));
}
