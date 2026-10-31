import { beforeEach, describe, expect, test } from 'vitest';
import { describeIssues, useMappingStore } from '@/state/useMappingStore';
import { mappingSchema, padIndex } from '@/mapping/schema';

const initial = useMappingStore.getState();
beforeEach(() => {
  localStorage.clear();
  useMappingStore.setState({ ...initial, customPresets: [] });
  useMappingStore.getState().setPreset('maschine-logic');
});

const padAt = (index: number) => {
  const m = useMappingStore.getState().mapping;
  return m.pads.find((p) => padIndex(m, p) === index)!;
};

describe('mapping editing', () => {
  test('updatePad edits voice and label, and swaps a note already in use', () => {
    const s = useMappingStore.getState();
    s.updatePad(12, { voice: 'cowbell', label: 'Bell' });
    expect(padAt(12)).toMatchObject({ voice: 'cowbell', label: 'Bell', note: 24 });
    s.updatePad(12, { label: '  ' });
    expect(padAt(12).label).toBeUndefined();
    s.updatePad(12, { note: 25 }); // pad 13 had 25 → gets 24
    expect(padAt(12).note).toBe(25);
    expect(padAt(13).note).toBe(24);
    expect(mappingSchema.safeParse(useMappingStore.getState().mapping).success).toBe(true);
    s.updatePad(99, { note: 1 }); // no such pad
    s.resetToPreset();
    expect(padAt(12)).toMatchObject({ voice: 'kick', note: 24 });
  });

  test('P5: custom preset saves to localStorage and reloads', async () => {
    const s = useMappingStore.getState();
    s.updatePad(12, { voice: 'clap' });
    const id = s.saveAsPreset('  Finger kit  ');
    expect(useMappingStore.getState()).toMatchObject({ presetId: id, mapping: { name: 'Finger kit' } });
    s.renamePreset(id, 'Finger kit v2');
    s.renamePreset(id, '   '); // ignored
    expect(useMappingStore.getState().mapping.name).toBe('Finger kit v2');

    const stored = JSON.parse(localStorage.getItem('drumr.v1.mapping')!).state;
    expect(stored.customPresets).toHaveLength(1);

    // Simulate a reload: wipe in-memory state (which persists too), restore storage, rehydrate.
    const saved = localStorage.getItem('drumr.v1.mapping')!;
    useMappingStore.setState({ ...initial, customPresets: [] });
    localStorage.setItem('drumr.v1.mapping', saved);
    await useMappingStore.persist.rehydrate();
    const after = useMappingStore.getState();
    expect(after.presetId).toBe(id);
    expect(after.customPresets[0]!.mapping.name).toBe('Finger kit v2');
    expect(padAt(12).voice).toBe('clap');

    after.setPreset('generic-gm');
    after.setPreset(id);
    expect(padAt(12).voice).toBe('clap');
    after.deletePreset(id);
    expect(useMappingStore.getState()).toMatchObject({ presetId: 'maschine-logic', customPresets: [] });
  });

  test('P5: import rejects invalid JSON with readable issues and does not change the active mapping', () => {
    const s = useMappingStore.getState();
    const before = useMappingStore.getState().mapping;
    expect(s.importMapping('{nope')).toEqual({ ok: false, issues: ['The file is not valid JSON.'] });

    const bad = {
      ...before,
      pads: [
        { ...before.pads[0], voice: 'gong' },
        { ...before.pads[1], note: before.pads[0]!.note },
      ],
    };
    const result = s.importMapping(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContain('pad 1 › voice: unknown voice');
      expect(result.issues.join()).toMatch(/note 24 is used by pads 1 and 2/);
    }
    expect(useMappingStore.getState().mapping).toBe(before);
    expect(useMappingStore.getState().customPresets).toHaveLength(0);

    const ok = s.importMapping(s.exportMapping());
    expect(ok.ok).toBe(true);
    expect(useMappingStore.getState().customPresets).toHaveLength(1);
    expect(useMappingStore.getState().mapping).toEqual(before);
  });

  test('describeIssues formats root-level and nested paths', () => {
    expect(
      describeIssues({
        issues: [
          { path: [], message: 'x' },
          { path: ['hihat', 'cc'], message: 'too big' },
        ],
      }),
    ).toEqual(['x', 'hihat › cc: too big']);
  });

  test('persisted custom presets that no longer validate are dropped', async () => {
    const good = useMappingStore.getState().mapping;
    localStorage.setItem(
      'drumr.v1.mapping',
      JSON.stringify({
        state: {
          presetId: 'maschine-logic',
          mapping: good,
          customPresets: [
            { id: 'a', mapping: good },
            { id: 'b', mapping: { name: 'bad' } },
          ],
        },
        version: 1,
      }),
    );
    await useMappingStore.persist.rehydrate();
    expect(useMappingStore.getState().customPresets.map((p) => p.id)).toEqual(['a']);
  });
});
