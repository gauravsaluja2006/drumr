import { describe, expect, test } from 'vitest';
import { DEFAULT_FX } from '@/engine/Effects';
import { useSettingsStore } from '@/state/useSettingsStore';

describe('saved effects', () => {
  test('malformed saved effects fall back to the defaults per effect', async () => {
    localStorage.setItem(
      'drumr.v1.settings',
      JSON.stringify({
        state: {
          fx: { good: { room: { on: true, amount: 0.5 }, hall: { on: 'yes' } }, bad: 3 },
          fxDefault: { echo: { on: true, amount: 9 } },
        },
        version: 1,
      }),
    );
    await useSettingsStore.persist.rehydrate();
    const s = useSettingsStore.getState();
    expect(s.fx.good).toEqual({ ...DEFAULT_FX, room: { on: true, amount: 0.5 } });
    expect(s.fx.bad).toBeUndefined();
    expect(s.fxDefault).toEqual(DEFAULT_FX);
  });
});
