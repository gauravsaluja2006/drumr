import { describe, expect, test } from 'vitest';
import { DEFAULT_FX } from '@/engine/Effects';
import { recommendedFx } from '@/kits/soundDefaults';
import { fxFor, useSettingsStore } from '@/state/useSettingsStore';

describe('saved effects', () => {
  test('malformed saved effects fall back to the kit’s recommended sound per effect', async () => {
    localStorage.setItem(
      'drumr.v1.settings',
      JSON.stringify({
        state: {
          fx: { good: { room: { on: true, amount: 0.5 }, hall: { on: 'yes' } }, bad: 3 },
          fxDefault: { echo: { on: true, amount: 9 } },
        },
        version: 2,
      }),
    );
    await useSettingsStore.persist.rehydrate();
    const s = useSettingsStore.getState();
    expect(s.fx.good).toEqual({ ...recommendedFx('good'), room: { on: true, amount: 0.5 } });
    expect(s.fx.bad).toBeUndefined();
    expect(s.fxDefault).toBeNull(); // malformed: back to each kit's recommended sound
  });

  test('every kit starts with a little room and hall; drum machines get less than acoustic kits', async () => {
    // Settings from before recommended sounds existed (v1 saved "all off") are migrated away.
    localStorage.setItem(
      'drumr.v1.settings',
      JSON.stringify({ state: { fx: { 'sm-drums': DEFAULT_FX }, fxDefault: DEFAULT_FX }, version: 1 }),
    );
    await useSettingsStore.persist.rehydrate();
    const s = useSettingsStore.getState();
    const acoustic = fxFor(s, 'sm-drums');
    const electronic = fxFor(s, 'dm-tr808');
    expect(acoustic.room.on && acoustic.hall.on && electronic.room.on && electronic.hall.on).toBe(true);
    expect(electronic.room.amount).toBeLessThan(acoustic.room.amount);
    expect(fxFor(s, 'sm-drums')).toBe(acoustic); // stable identity for React selectors

    s.setFx('sm-drums', 'plate', { on: true });
    s.setGroup('sm-drums', 'snare', { tune: 3.4, decay: 0.02 });
    expect(useSettingsStore.getState().mix['sm-drums']?.snare).toMatchObject({ tune: 3, decay: 0.1 });
    useSettingsStore.getState().resetKitSound('sm-drums');
    expect(fxFor(useSettingsStore.getState(), 'sm-drums')).toBe(acoustic);
    expect(useSettingsStore.getState().mix['sm-drums']).toBeUndefined();
  });
});
