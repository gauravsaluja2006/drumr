import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Group } from '@/kits/schema';
import { z } from 'zod';
import { DEFAULT_ROTATION, MAX_BPM, MIN_BPM, type RotationSettings } from '@/kits/rotation';
import { EFFECTS, type EffectId, type EffectSetting, type FxSettings } from '@/engine/Effects';
import { MIN_DECAY } from '@/engine/AudioEngine';
import { recommendedFx } from '@/kits/soundDefaults';

export const MASTER_MIN_DB = -60;
export const MASTER_MAX_DB = 6;

export interface GroupSetting {
  db: number;
  muted: boolean;
  /** Semitones, −12…+12. */
  tune?: number;
  /** Fraction of the natural decay, 0.1…1. */
  decay?: number;
}
export const DEFAULT_GROUP: GroupSetting = { db: 0, muted: false };
type KitMix = Partial<Record<Group, GroupSetting>>;

const EffectSchema = z.object({ on: z.boolean(), amount: z.number().min(0).max(1) });

/** Saved effects for a kit; an effect that does not parse falls back to `fallback`'s. */
function cleanFx(value: unknown, fallback: FxSettings): FxSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const out = { ...fallback };
  for (const id of EFFECTS) {
    const parsed = EffectSchema.safeParse((value as Record<string, unknown>)[id]);
    if (parsed.success) out[id] = parsed.data;
  }
  return out;
}

/** The shared default must be complete; anything malformed means "recommended per kit". */
function cleanFxDefault(value: unknown): FxSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  return EFFECTS.every((id) => EffectSchema.safeParse(v[id]).success) ? (value as FxSettings) : null;
}

/**
 * The effects a kit plays with: its own if the player changed them, else the shared default
 * ("Use on all kits"), else the kit's recommended sound.
 */
export const fxFor = (
  s: { fx: Record<string, FxSettings>; fxDefault: FxSettings | null },
  kitId: string | null,
): FxSettings => (kitId ? s.fx[kitId] : undefined) ?? s.fxDefault ?? recommendedFx(kitId);

interface SettingsState {
  masterDb: number;
  lastKitId: string | null;
  /** Per-kit group mix: kit id → group → gain and mute (docs/04-ROADMAP.md Phase 6). */
  mix: Record<string, KitMix>;
  /** Kit rotation settings (whether it is running is not persisted). */
  rotation: RotationSettings;
  /** Loop length on close: exactly as played, or rounded to whole bars at the rotation tempo. */
  loopLength: 'free' | 'bars';
  /** Per-kit reverb/echo settings; kits without their own use `fxDefault`. */
  fx: Record<string, FxSettings>;
  fxDefault: FxSettings | null;
  /** Small per-hit level and pitch variation (natural feel). */
  humanize: boolean;
  setHumanize: (on: boolean) => void;
  /** Back to the recommended sound for a kit: effects, tune and length, volumes. */
  resetKitSound: (kitId: string) => void;
  setFx: (kitId: string, effect: EffectId, patch: Partial<EffectSetting>) => void;
  /** Make a kit's effects the default and drop every per-kit override. */
  applyFxToAll: (kitId: string) => void;
  setLoopLength: (mode: 'free' | 'bars') => void;
  setRotation: (patch: Partial<RotationSettings>) => void;
  setMasterDb: (db: number) => void;
  setGroup: (kitId: string, group: Group, patch: Partial<GroupSetting>) => void;
  setLastKitId: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      masterDb: 0,
      lastKitId: null,
      mix: {},
      rotation: DEFAULT_ROTATION,
      loopLength: 'free',
      fx: {},
      fxDefault: null,
      humanize: true,
      setHumanize: (on) => set({ humanize: on }),
      resetKitSound: (kitId) =>
        set((s) => {
          const fx = { ...s.fx };
          const mix = { ...s.mix };
          delete fx[kitId];
          delete mix[kitId];
          return { fx, mix };
        }),
      setFx: (kitId, effect, patch) =>
        set((s) => {
          const current = fxFor(s, kitId);
          const next = { ...current[effect], ...patch };
          next.amount = Math.min(1, Math.max(0, next.amount));
          return { fx: { ...s.fx, [kitId]: { ...current, [effect]: next } } };
        }),
      applyFxToAll: (kitId) => set((s) => ({ fxDefault: fxFor(s, kitId), fx: {} })),
      setLoopLength: (mode) => set({ loopLength: mode }),
      setRotation: (patch) =>
        set((s) => {
          const next = { ...s.rotation, ...patch };
          next.bpm = Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, next.bpm)));
          return { rotation: next };
        }),
      setGroup: (kitId, group, patch) =>
        set((s) => {
          const current = s.mix[kitId]?.[group] ?? DEFAULT_GROUP;
          const next = { ...current, ...patch };
          next.db = Math.min(MASTER_MAX_DB, Math.max(MASTER_MIN_DB, next.db));
          if (next.tune !== undefined) next.tune = Math.round(Math.min(12, Math.max(-12, next.tune)));
          if (next.decay !== undefined) next.decay = Math.min(1, Math.max(MIN_DECAY, next.decay));
          return { mix: { ...s.mix, [kitId]: { ...s.mix[kitId], [group]: next } } };
        }),
      setMasterDb: (db) => set({ masterDb: Math.min(MASTER_MAX_DB, Math.max(MASTER_MIN_DB, db)) }),
      setLastKitId: (id) => set({ lastKitId: id }),
    }),
    {
      name: 'drumr.v1.settings',
      version: 2,
      // v1 saved effects as "all off" before kits had a recommended sound: start from the recommendations.
      migrate: (persisted, version) => {
        const p = { ...(persisted as Record<string, unknown>) };
        if (version < 2) {
          delete p.fx;
          delete p.fxDefault;
        }
        return p;
      },
      // Settings saved before rotation existed get the defaults for the new fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const fx: Record<string, FxSettings> = {};
        for (const [id, v] of Object.entries(p.fx ?? {})) {
          const clean = cleanFx(v, recommendedFx(id));
          if (clean) fx[id] = clean;
        }
        return {
          ...current,
          ...p,
          rotation: { ...DEFAULT_ROTATION, ...p.rotation },
          fx,
          fxDefault: cleanFxDefault(p.fxDefault),
        };
      },
    },
  ),
);
