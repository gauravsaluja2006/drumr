import { beforeEach, describe, expect, test } from 'vitest';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { setRuntime } from '@/app/runtime';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();

beforeEach(() => {
  localStorage.clear();
  useKitStore.setState(initialKit, true);
  useSettingsStore.setState({ masterDb: 0, lastKitId: null });
});

describe('useKitStore', () => {
  test('init loads the index and the first kit, reporting progress', async () => {
    const rt = installFakeRuntime();
    const seen: string[] = [];
    const unsub = useKitStore.subscribe((s) => seen.push(s.status));
    await useKitStore.getState().init();
    unsub();
    const s = useKitStore.getState();
    expect(s.status).toBe('ready');
    expect(s.currentKitId).toBe('test-kit');
    expect(s.progress.loaded).toBe(s.progress.total);
    expect(seen).toContain('loading');
    expect([...s.available]).toContain('kick');
    expect(rt.engine.stats().kitId).toBe('test-kit');
    expect(useSettingsStore.getState().lastKitId).toBe('test-kit');
  });

  test('init prefers the remembered kit', async () => {
    installFakeRuntime();
    useSettingsStore.setState({ lastKitId: 'kit-b' });
    await useKitStore.getState().init();
    expect(useKitStore.getState().currentKitId).toBe('kit-b');
  });

  test('a failing switch keeps the previous kit and reports the error', async () => {
    installFakeRuntime({ failKit: 'kit-b' });
    await useKitStore.getState().init();
    await useKitStore.getState().switchKit('kit-b');
    const s = useKitStore.getState();
    expect(s.status).toBe('ready');
    expect(s.currentKitId).toBe('test-kit');
    expect(s.error).toMatch(/kit-b/);
  });

  test('the newest of two concurrent switches wins', async () => {
    installFakeRuntime({ delayMs: 5 });
    await useKitStore.getState().init();
    const a = useKitStore.getState().switchKit('kit-b');
    const b = useKitStore.getState().switchKit('test-kit');
    await Promise.all([a, b]);
    expect(useKitStore.getState().currentKitId).toBe('test-kit');
  });

  test('init errors without a runtime', async () => {
    setRuntime(null);
    // getRuntime falls back to creating a real AudioContext, which jsdom lacks.
    await useKitStore.getState().init();
    expect(useKitStore.getState().status).toBe('error');
    expect(useKitStore.getState().error).toMatch(/Web Audio/);
  });
});

describe('useSettingsStore', () => {
  test('clamps master gain and persists to localStorage', () => {
    useSettingsStore.getState().setMasterDb(20);
    expect(useSettingsStore.getState().masterDb).toBe(6);
    useSettingsStore.getState().setMasterDb(-100);
    expect(useSettingsStore.getState().masterDb).toBe(-60);
    expect(JSON.parse(localStorage.getItem('drumr.v1.settings')!).state.masterDb).toBe(-60);
  });
});
