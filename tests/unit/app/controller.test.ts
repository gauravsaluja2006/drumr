import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getLastHit, handleMidi, hitPad, onHit, padForNote } from '@/app/controller';
import { setRuntime } from '@/app/runtime';
import { useKitStore } from '@/state/useKitStore';
import { useMappingStore } from '@/state/useMappingStore';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', () => 0);
  useKitStore.setState(initialKit, true);
  useMappingStore.getState().setPreset('maschine-logic');
  installFakeRuntime();
  await useKitStore.getState().init();
});
afterEach(() => {
  vi.unstubAllGlobals();
  setRuntime(null);
});

const noteOn = (note: number, velocity: number, channel = 1) => ({
  type: 'noteon' as const,
  channel,
  note,
  velocity,
});

describe('controller', () => {
  test('MIDI note-on → pad → voice → articulation with the curved velocity', async () => {
    const { getRuntime } = await import('@/app/runtime');
    const engine = getRuntime().engine;
    handleMidi(noteOn(25, 100), performance.now());
    expect(engine.stats().lastTrigger).toMatchObject({ articulationId: 'snare.center', velocity: 115 });
    expect(getLastHit()).toMatchObject({
      padIndex: 13,
      voice: 'snare.center',
      inVelocity: 100,
      velocity: 115,
      source: 'midi',
    });

    handleMidi(noteOn(29, 127), 0); // rimshot → falls back to snare.center in the test kit
    expect(getLastHit()).toMatchObject({ voice: 'snare.rimshot', articulationId: 'snare.center' });
    handleMidi(noteOn(31, 64), 0); // hihat.cc → most open level by default (Phase 3)
    expect(getLastHit()?.articulationId).toBe('hihat.open');

    const before = engine.stats().triggers;
    handleMidi(noteOn(36, 100), 0); // crash: not in test kit → no sound, pad still flashes
    expect(getLastHit()).toMatchObject({ voice: 'crash.left', articulationId: null });
    handleMidi(noteOn(99, 100), 0); // unmapped
    handleMidi({ type: 'noteoff', channel: 1, note: 25, velocity: 0 }, 0);
    handleMidi({ type: 'cc', channel: 1, controller: 1, value: 10 }, 0);
    expect(engine.stats().triggers).toBe(before);
  });

  test('channel filter and preset switching rebuild the note table', () => {
    useMappingStore.setState((s) => ({ mapping: { ...s.mapping, channel: 10 } }));
    handleMidi(noteOn(24, 100, 1), 0);
    expect(getLastHit()?.voice).not.toBe('kick');
    handleMidi(noteOn(24, 100, 10), 0);
    expect(getLastHit()?.voice).toBe('kick');

    expect(padForNote(24)).toBe(12);
    useMappingStore.getState().setPreset('generic-gm');
    expect(padForNote(24)).toBeUndefined();
    expect(padForNote(36)).toBe(12);
  });

  test('UI hits bypass the curve and notify listeners', () => {
    const seen: number[] = [];
    const off = onHit((h) => seen.push(h.velocity));
    hitPad(12, 50);
    hitPad(99, 50); // no pad
    off();
    hitPad(12, 60);
    expect(seen).toEqual([50]);
    expect(getLastHit()).toMatchObject({ source: 'ui', velocity: 60, inVelocity: 60 });
  });
});
