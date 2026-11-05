import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { hitPad, getLastHit } from '@/app/controller';
import {
  installLooper,
  loopClear,
  loopMain,
  loopStopPlay,
  loopUndo,
  looper,
  useLoopStore,
} from '@/app/looper';
import { resetRotation, startRotation, useRotationStore } from '@/app/rotation';
import { setRuntime } from '@/app/runtime';
import { useKitStore } from '@/state/useKitStore';
import { useMappingStore } from '@/state/useMappingStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { DEFAULT_ROTATION } from '@/kits/rotation';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
let rt: ReturnType<typeof installFakeRuntime>;
let uninstall: () => void;
type Played = { id: string; kit: string | undefined; perf: number; at: number };
let played: Played[];

beforeEach(async () => {
  localStorage.clear();
  useKitStore.setState(initialKit, true);
  useMappingStore.getState().setPreset('maschine-logic');
  useSettingsStore.setState({ rotation: DEFAULT_ROTATION, loopLength: 'free', lastKitId: null });
  rt = installFakeRuntime();
  await useKitStore.getState().init();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  uninstall = installLooper();
  played = [];
  rt.engine.onTrigger((t) =>
    played.push({
      id: t.articulationId,
      kit: rt.engine.currentKit?.manifest.id,
      perf: performance.now(),
      at: t.atTime,
    }),
  );
});
afterEach(() => {
  loopClear();
  resetRotation();
  uninstall();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  setRuntime(null);
});

const KICK = 12; // Maschine layout pad 13 (index 12): kick, note 24
const SNARE = 13;
const loopHits = () => played.filter((p) => p.perf >= 0);

describe('looper runtime', () => {
  test('arming waits for the first hit; closing replays from frame 0 at once and repeats with no gap', async () => {
    loopMain(); // arm
    expect(useLoopStore.getState().phase).toBe('armed');
    await vi.advanceTimersByTimeAsync(3_000); // nothing recorded while waiting
    const t0 = performance.now();
    hitPad(KICK, 100, t0);
    await vi.advanceTimersByTimeAsync(500);
    hitPad(SNARE, 90, performance.now());
    await vi.advanceTimersByTimeAsync(500);
    expect(useLoopStore.getState().phase).toBe('recording');
    played = [];
    loopMain(); // close at t0 + 1000
    expect(useLoopStore.getState()).toMatchObject({ phase: 'playing', length: 1_000 });
    // Frame 0 (kick) is handed to the engine immediately for "now".
    expect(played.map((p) => p.id)).toEqual(['kick']);
    expect(played[0]!.at).toBe(rt.ctx.currentTime);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(loopHits().map((p) => p.id)).toEqual(['kick', 'snare.center', 'kick', 'snare.center', 'kick']);
    // Each hit is scheduled ahead of time on the audio clock, at exactly its loop position.
    for (const p of played) {
      const due = Math.round((p.perf + (p.at - rt.ctx.currentTime) * 1000 - t0) % 500);
      expect(due === 0 || due === 500).toBe(true);
    }
    expect(getLastHit()?.source).toBe('loop');
  });

  test('stop, play from frame 0, overdub a layer, undo it', async () => {
    loopMain();
    hitPad(KICK, 100, performance.now());
    await vi.advanceTimersByTimeAsync(1_000);
    loopMain(); // close: 1 s loop
    loopStopPlay();
    expect(useLoopStore.getState().phase).toBe('stopped');
    played = [];
    await vi.advanceTimersByTimeAsync(3_000);
    expect(played).toEqual([]);

    loopStopPlay(); // play: frame 0 now
    expect(played.map((p) => p.id)).toEqual(['kick']);
    await vi.advanceTimersByTimeAsync(1_000 - 1);
    loopMain(); // overdub
    await vi.advanceTimersByTimeAsync(251);
    hitPad(SNARE, 80, performance.now()); // 250 ms into the pass
    loopMain(); // finish overdub
    await vi.runOnlyPendingTimersAsync();
    expect(useLoopStore.getState()).toMatchObject({ phase: 'playing', layers: 2 });
    played = [];
    await vi.advanceTimersByTimeAsync(1_000);
    expect(played.map((p) => p.id)).toEqual(['kick', 'snare.center']);

    loopUndo();
    played = [];
    await vi.advanceTimersByTimeAsync(1_000);
    expect(played.map((p) => p.id)).toEqual(['kick']);
  });

  test('rotation every loop pass switches kit exactly on the downbeat, so frame 0 plays on the new kit', async () => {
    useSettingsStore.getState().setRotation({ mode: 'loops', loops: 1 });
    loopMain();
    hitPad(KICK, 100, performance.now());
    await vi.advanceTimersByTimeAsync(400);
    hitPad(SNARE, 100, performance.now());
    await vi.advanceTimersByTimeAsync(600);
    loopMain(); // 1 s loop, playing
    expect(startRotation()).toBe(true);
    await vi.advanceTimersByTimeAsync(0); // preload kit-b
    expect(rt.sampler.residentKitIds).toContain('kit-b');
    expect(useRotationStore.getState().nextAt).toBe(performance.now() + 1_000);

    played = [];
    await vi.advanceTimersByTimeAsync(2_000);
    expect(played.map((p) => `${p.id}@${p.kit}`)).toEqual([
      'snare.center@test-kit',
      'kick@kit-b',
      'snare.center@kit-b',
      'kick@test-kit',
    ]);
  });

  test('stopping a loop pauses loop-pass rotation; a short loop is thrown away', async () => {
    useSettingsStore.getState().setRotation({ mode: 'loops', loops: 1 });
    loopMain();
    hitPad(KICK, 100, performance.now());
    await vi.advanceTimersByTimeAsync(100);
    loopMain(); // 100 ms: too short
    expect(useLoopStore.getState().phase).toBe('idle');
    expect(looper.events).toEqual([]);

    loopMain();
    hitPad(KICK, 100, performance.now());
    await vi.advanceTimersByTimeAsync(1_000);
    loopMain();
    startRotation();
    loopStopPlay();
    expect(useRotationStore.getState().nextAt).toBeNull();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(useKitStore.getState().currentKitId).toBe('test-kit');
  });

  test('whole-bar length rounds the press to the nearest bar at the rotation tempo', async () => {
    useSettingsStore.setState({ loopLength: 'bars' });
    useSettingsStore.getState().setRotation({ bpm: 120 }); // 2 s bars
    loopMain();
    hitPad(KICK, 100, performance.now());
    await vi.advanceTimersByTimeAsync(4_300); // a little late for 2 bars
    loopMain();
    expect(useLoopStore.getState().length).toBe(4_000);
    expect(looper.position(performance.now())).toBe(300);
    expect(useRotationStore.getState().tempoAnchor).toBe(looper.start);
  });
});
