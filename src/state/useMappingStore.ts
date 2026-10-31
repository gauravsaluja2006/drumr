import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILTIN_PRESETS, DEFAULT_PRESET_ID } from '@/mapping/presets';
import { mappingSchema, padIndex, type Mapping, type PadMapping } from '@/mapping/schema';

export interface CustomPreset {
  id: string;
  mapping: Mapping;
}

export type ImportResult = { ok: true; mapping: Mapping } | { ok: false; issues: string[] };

interface MappingState {
  /** Built-in id or a custom preset id ("custom-…"). */
  presetId: string;
  /** The live mapping. Edits apply here immediately and persist. */
  mapping: Mapping;
  customPresets: CustomPreset[];
  setPreset: (id: string) => void;
  setVelocity: (v: Partial<Mapping['velocity']>) => void;
  setHihat: (h: Partial<Mapping['hihat']>) => void;
  /** Edit one pad by screen index. A note already used by another pad is swapped onto it. */
  updatePad: (index: number, patch: Partial<Pick<PadMapping, 'note' | 'voice' | 'label'>>) => void;
  /** Restore the active preset's saved version, discarding unsaved edits. */
  resetToPreset: () => void;
  saveAsPreset: (name: string) => string;
  renamePreset: (id: string, name: string) => void;
  deletePreset: (id: string) => void;
  importMapping: (json: string) => ImportResult;
  exportMapping: () => string;
}

const builtin = (id: string) => BUILTIN_PRESETS.find((p) => p.id === id)?.mapping;
const newId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Readable one-line issues for an invalid mapping file. */
export function describeIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string[] {
  return error.issues.map((i) => {
    const path = i.path
      .map((p, n) => (typeof p === 'number' && i.path[n - 1] === 'pads' ? `pad ${p + 1}` : String(p)))
      .filter((p) => p !== 'pads')
      .join(' › ');
    return path ? `${path}: ${i.message}` : i.message;
  });
}

export const useMappingStore = create<MappingState>()(
  persist(
    (set, get) => {
      const presetMapping = (id: string) =>
        builtin(id) ?? get().customPresets.find((p) => p.id === id)?.mapping;
      return {
        presetId: DEFAULT_PRESET_ID,
        mapping: builtin(DEFAULT_PRESET_ID)!,
        customPresets: [],

        setPreset: (id) => {
          const m = presetMapping(id) ?? BUILTIN_PRESETS[0]!.mapping;
          set({ presetId: presetMapping(id) ? id : BUILTIN_PRESETS[0]!.id, mapping: m });
        },
        setVelocity: (v) =>
          set({ mapping: { ...get().mapping, velocity: { ...get().mapping.velocity, ...v } } }),
        setHihat: (h) => set({ mapping: { ...get().mapping, hihat: { ...get().mapping.hihat, ...h } } }),

        updatePad: (index, patch) => {
          const m = get().mapping;
          const target = m.pads.find((p) => padIndex(m, p) === index);
          if (!target) return;
          const pads = m.pads.map((p) => {
            if (p === target) {
              const next: PadMapping = { ...p, ...patch };
              if (patch.label !== undefined && patch.label.trim() === '') delete next.label;
              return next;
            }
            if (patch.note !== undefined && p.note === patch.note) return { ...p, note: target.note };
            return p;
          });
          set({ mapping: { ...m, pads } });
        },

        resetToPreset: () => {
          const m = presetMapping(get().presetId);
          if (m) set({ mapping: m });
        },

        saveAsPreset: (name) => {
          const id = newId();
          const mapping = { ...get().mapping, name: name.trim() || 'My layout' };
          set({ customPresets: [...get().customPresets, { id, mapping }], presetId: id, mapping });
          return id;
        },

        renamePreset: (id, name) => {
          const clean = name.trim();
          if (!clean) return;
          set({
            customPresets: get().customPresets.map((p) =>
              p.id === id ? { ...p, mapping: { ...p.mapping, name: clean } } : p,
            ),
            mapping: get().presetId === id ? { ...get().mapping, name: clean } : get().mapping,
          });
        },

        deletePreset: (id) => {
          set({ customPresets: get().customPresets.filter((p) => p.id !== id) });
          if (get().presetId === id) get().setPreset(DEFAULT_PRESET_ID);
        },

        importMapping: (json) => {
          let data: unknown;
          try {
            data = JSON.parse(json);
          } catch {
            return { ok: false, issues: ['The file is not valid JSON.'] };
          }
          const parsed = mappingSchema.safeParse(data);
          if (!parsed.success) return { ok: false, issues: describeIssues(parsed.error) };
          const id = newId();
          set({
            customPresets: [...get().customPresets, { id, mapping: parsed.data }],
            presetId: id,
            mapping: parsed.data,
          });
          return { ok: true, mapping: parsed.data };
        },

        exportMapping: () => JSON.stringify(get().mapping, null, 2) + '\n',
      };
    },
    {
      name: 'drumr.v1.mapping',
      version: 1,
      partialize: (s) => ({ presetId: s.presetId, mapping: s.mapping, customPresets: s.customPresets }),
      // Never trust persisted data blindly: drop anything that no longer validates.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MappingState>;
        const customPresets = (p.customPresets ?? []).flatMap((c) => {
          const r = mappingSchema.safeParse(c?.mapping);
          return r.success && typeof c.id === 'string' ? [{ id: c.id, mapping: r.data }] : [];
        });
        const parsed = mappingSchema.safeParse(p.mapping);
        return {
          ...current,
          customPresets,
          ...(parsed.success ? { presetId: p.presetId ?? current.presetId, mapping: parsed.data } : {}),
        };
      },
    },
  ),
);
