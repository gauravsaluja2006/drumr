import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Group } from '@/kits/schema';
import { z } from 'zod';
import { DEFAULT_ROTATION, MAX_BPM, MIN_BPM, type RotationSettings } from '@/kits/rotation';
import { DEFAULT_FX, EFFECTS, type EffectId, type EffectSetting, type FxSettings } from '@/engine/Effects';

export const MASTER_MIN_DB = -60;
export const MASTER_MAX_DB = 6;

export interface GroupSetting {
  db: number;
  muted: boolean;
}
export const DEFAULT_GROUP: GroupSetting = { db: 0, muted: false };
type KitMix = Partial<Record<Group, GroupSetting>>;

const EffectSchema = z.object({ on: z.boolean(), amount: z.number().min(0).max(1) });

/** Saved effects, falling back per effect to the defaults (drops anything malformed). */
function cleanFx(value: unknown): FxSettings | null {
  if (typeof value !== 'object' || value === null) return null;
  const out = { ...DEFAULT_FX };
  for (const id of EFFECTS) {
    const parsed = EffectSchema.safeParse((value as Record<string, unknown>)[id]);
    if (parsed.success) out[id] = parsed.data;
  }
  return out;
}

/** The effects a kit plays with: its own if it has any, else the shared default. */
export const fxFor = (s: { fx: Record<string, FxSettings>; fxDefault: FxSettings }, kitId: string | null) =>
  (kitId ? s.fx[kitId] : undefined) ?? s.fxDefault;

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
  fxDefault: FxSettings;
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
      fxDefault: DEFAULT_FX,
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
          return { mix: { ...s.mix, [kitId]: { ...s.mix[kitId], [group]: next } } };
        }),
      setMasterDb: (db) => set({ masterDb: Math.min(MASTER_MAX_DB, Math.max(MASTER_MIN_DB, db)) }),
      setLastKitId: (id) => set({ lastKitId: id }),
    }),
    {
      name: 'drumr.v1.settings',
      version: 1,
      // Settings saved before rotation existed get the defaults for the new fields.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const fx: Record<string, FxSettings> = {};
        for (const [id, v] of Object.entries(p.fx ?? {})) {
          const clean = cleanFx(v);
          if (clean) fx[id] = clean;
        }
        return {
          ...current,
          ...p,
          rotation: { ...DEFAULT_ROTATION, ...p.rotation },
          fx,
          fxDefault: cleanFx(p.fxDefault) ?? DEFAULT_FX,
        };
      },
    },
  ),
);
