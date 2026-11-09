import type { FxSettings } from '@/engine/Effects';

/**
 * Recommended sound per kit, used until the player changes it (ADR-41). Every kit gets a little
 * room and hall so it never sounds dry out of the box. Acoustic kits get more room (they were
 * recorded close and dry); drum machines get less so they stay punchy.
 */
export type KitStyle = 'acoustic' | 'electronic';

const ELECTRONIC_PREFIXES = ['dm-', 'trap-', 'ni-'];

export function kitStyle(kitId: string): KitStyle {
  return ELECTRONIC_PREFIXES.some((p) => kitId.startsWith(p)) ? 'electronic' : 'acoustic';
}

const OFF = { on: false, amount: 0.3 };

/** Constant objects: selectors return them by identity, so React does not re-render needlessly. */
export const RECOMMENDED_FX: Readonly<Record<KitStyle, FxSettings>> = {
  acoustic: {
    room: { on: true, amount: 0.45 },
    hall: { on: true, amount: 0.25 },
    plate: OFF,
    echo: { on: false, amount: 0.25 },
  },
  electronic: {
    room: { on: true, amount: 0.3 },
    hall: { on: true, amount: 0.15 },
    plate: OFF,
    echo: { on: false, amount: 0.25 },
  },
};

export const recommendedFx = (kitId: string | null): FxSettings =>
  RECOMMENDED_FX[kitId ? kitStyle(kitId) : 'acoustic'];
