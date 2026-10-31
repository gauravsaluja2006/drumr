import { describe, expect, test } from 'vitest';
import { useMappingStore } from '@/state/useMappingStore';

describe('useMappingStore', () => {
  test('switches presets and edits velocity and hi-hat settings', () => {
    const s = useMappingStore.getState();
    s.setPreset('generic-gm');
    expect(useMappingStore.getState().mapping.pads[0]!.note).toBe(36);
    s.setVelocity({ exponent: 3 });
    s.setHihat({ invert: true });
    expect(useMappingStore.getState().mapping.velocity).toEqual({ exponent: 3, floor: 28 });
    expect(useMappingStore.getState().mapping.hihat).toEqual({ cc: 4, invert: true, pedalOnClose: false });
    s.setPreset('nope');
    expect(useMappingStore.getState().mapping.name).toMatch(/Maschine/);
  });

  test('ignores persisted mappings that no longer validate', async () => {
    localStorage.setItem(
      'drumr.v1.mapping',
      JSON.stringify({ state: { presetId: 'x', mapping: { name: 'broken' } }, version: 1 }),
    );
    await useMappingStore.persist.rehydrate();
    expect(useMappingStore.getState().mapping.pads).toHaveLength(16);
    const good = { ...useMappingStore.getState().mapping, name: 'Mine' };
    localStorage.setItem(
      'drumr.v1.mapping',
      JSON.stringify({ state: { presetId: 'custom', mapping: good }, version: 1 }),
    );
    await useMappingStore.persist.rehydrate();
    expect(useMappingStore.getState()).toMatchObject({ presetId: 'custom', mapping: { name: 'Mine' } });
  });
});
