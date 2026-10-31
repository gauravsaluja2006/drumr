import { describe, expect, test } from 'vitest';
import { useSettingsStore } from '@/state/useSettingsStore';

describe('per-kit mix', () => {
  test('P6: group gains persist per kit id', async () => {
    localStorage.clear();
    useSettingsStore.setState({ mix: {} });
    const s = useSettingsStore.getState();
    s.setGroup('kit-a', 'hihat', { db: -12 });
    s.setGroup('kit-a', 'kick', { muted: true });
    s.setGroup('kit-b', 'hihat', { db: 99 }); // clamped to +6
    expect(useSettingsStore.getState().mix).toEqual({
      'kit-a': { hihat: { db: -12, muted: false }, kick: { db: 0, muted: true } },
      'kit-b': { hihat: { db: 6, muted: false } },
    });
    const saved = localStorage.getItem('drumr.v1.settings')!;
    useSettingsStore.setState({ mix: {} });
    localStorage.setItem('drumr.v1.settings', saved);
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().mix['kit-a']?.hihat).toEqual({ db: -12, muted: false });
    expect(useSettingsStore.getState().mix['kit-b']?.hihat?.db).toBe(6);
  });
});
