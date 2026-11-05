import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  EARLY_MS,
  canRotate,
  resetRotation,
  startRotation,
  stopRotation,
  tapRotationTempo,
  toggleRotation,
  useRotationStore,
} from '@/app/rotation';
import { setRuntime } from '@/app/runtime';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { DEFAULT_ROTATION } from '@/kits/rotation';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
let rt: ReturnType<typeof installFakeRuntime>;

beforeEach(async () => {
  localStorage.clear();
  useKitStore.setState(initialKit, true);
  useSettingsStore.setState({ rotation: DEFAULT_ROTATION, lastKitId: null });
  rt = installFakeRuntime();
  await useKitStore.getState().init();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
});
afterEach(() => {
  resetRotation();
  vi.useRealTimers();
  setRuntime(null);
});

const current = () => useKitStore.getState().currentKitId;

describe('kit rotation runtime', () => {
  test('switches to the next kit every N seconds, preloading it first so no loading state shows', async () => {
    useSettingsStore.getState().setRotation({ mode: 'seconds', seconds: 10 });
    expect(current()).toBe('test-kit');
    expect(startRotation()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(rt.sampler.residentKitIds).toContain('kit-b'); // preloaded during the first interval

    const statuses: string[] = [];
    const off = useKitStore.subscribe((s) => statuses.push(s.status));
    await vi.advanceTimersByTimeAsync(9_999);
    expect(current()).toBe('test-kit');
    await vi.advanceTimersByTimeAsync(1);
    expect(current()).toBe('kit-b');
    expect(statuses).not.toContain('loading');
    off();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(current()).toBe('test-kit'); // wraps
    stopRotation();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(current()).toBe('test-kit');
  });

  test('only ticked kits rotate; ticking just the playing kit keeps rotation running on that kit', async () => {
    useSettingsStore.getState().setRotation({ mode: 'seconds', seconds: 10, kitIds: ['test-kit'] });
    expect(canRotate()).toBe(true);
    expect(startRotation()).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(current()).toBe('test-kit');
    expect(useRotationStore.getState().running).toBe(true);
    useSettingsStore.getState().setRotation({ kitIds: ['test-kit', 'kit-b'] });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(current()).toBe('kit-b');
  });

  test('rotation needs at least two kits', () => {
    useKitStore.setState({ index: useKitStore.getState().index.slice(0, 1) });
    expect(canRotate()).toBe(false);
    expect(startRotation()).toBe(false);
  });

  test('picking a kit by hand restarts the seconds countdown', async () => {
    useSettingsStore.getState().setRotation({ mode: 'seconds', seconds: 10 });
    startRotation();
    await vi.advanceTimersByTimeAsync(8_000);
    await useKitStore.getState().switchKit('kit-b');
    expect(useRotationStore.getState().nextAt).toBe(performance.now() + 10_000);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(current()).toBe('kit-b');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(current()).toBe('test-kit');
  });

  test('bars mode switches just before each downbeat of the tapped tempo', async () => {
    useSettingsStore.getState().setRotation({ mode: 'bars', bars: 1 });
    // Tap 4 beats at 120 BPM starting at t = 1000: downbeats every 2 s from 1000.
    vi.advanceTimersByTime(1_000);
    const t0 = performance.now();
    for (let i = 0; i < 4; i++) tapRotationTempo(t0 + i * 500);
    expect(useSettingsStore.getState().rotation.bpm).toBe(120);
    toggleRotation();
    expect(useRotationStore.getState()).toMatchObject({ running: true, nextAt: t0 + 2_000, interval: 2_000 });
    await vi.advanceTimersByTimeAsync(2_000 - EARLY_MS - 1);
    expect(current()).toBe('test-kit');
    await vi.advanceTimersByTimeAsync(1);
    expect(current()).toBe('kit-b');
    expect(useRotationStore.getState().nextAt).toBe(t0 + 4_000);
    toggleRotation();
    expect(useRotationStore.getState().running).toBe(false);
  });
});
