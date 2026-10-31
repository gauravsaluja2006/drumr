import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getLastHit, handleMidi, hitPad, onHit, padForNote } from '@/app/controller';
import { setRuntime } from '@/app/runtime';
import { useKitStore } from '@/state/useKitStore';
import { useMappingStore } from '@/state/useMappingStore';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
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

describe('controller: hi-hat', () => {
  test('CC on the mapped controller sets openness; other CCs and channels are ignored', async () => {
    const { hihat, currentHihatArticulation } = await import('@/app/controller');
    hihat.value = null;
    expect(currentHihatArticulation()).toBe('hihat.open');
    handleMidi({ type: 'cc', channel: 1, controller: 1, value: 0 }, 0); // Maschine preset: CC1, high = open
    expect(hihat.value).toBe(0);
    expect(currentHihatArticulation()).toBe('hihat.closed');
    handleMidi(noteOn(31, 100), 0);
    expect(getLastHit()).toMatchObject({ voice: 'hihat.cc', articulationId: 'hihat.closed' });
    handleMidi({ type: 'cc', channel: 1, controller: 7, value: 127 }, 0);
    expect(hihat.value).toBe(0);
    handleMidi({ type: 'cc', channel: 1, controller: 1, value: 127 }, 0);
    handleMidi(noteOn(31, 100), 0);
    expect(getLastHit()?.articulationId).toBe('hihat.open');
  });

  test('open hats ring their pad until choked; pedal-on-close plays a chick', async () => {
    const { hihat } = await import('@/app/controller');
    const { getRuntime } = await import('@/app/runtime');
    const pad = document.createElement('button');
    const { registerPad, flushPadFlash: flush } = await import('@/ui/PadGrid/padFlash');
    registerPad(11, pad);

    hihat.value = 127;
    handleMidi(noteOn(31, 100), 0); // open hat on pad 11
    flush();
    expect(pad.hasAttribute('data-ringing')).toBe(true);
    handleMidi(noteOn(27, 100), 0); // closed tip chokes it
    flush();
    expect(pad.hasAttribute('data-ringing')).toBe(false);
    expect(getRuntime().engine.stats().chokes).toBe(1);

    useMappingStore.getState().setHihat({ pedalOnClose: true });
    handleMidi(noteOn(31, 100), 0);
    const before = getRuntime().engine.stats().triggers;
    handleMidi({ type: 'cc', channel: 1, controller: 1, value: 0 }, 0); // fully closed while ringing
    expect(getRuntime().engine.stats().triggers).toBe(before + 1); // pedal falls back to hihat.closed in the test kit
    expect(getRuntime().engine.stats().lastTrigger).toMatchObject({
      articulationId: 'hihat.closed',
      velocity: 60,
    });
    handleMidi({ type: 'cc', channel: 1, controller: 1, value: 0 }, 0); // already closed: nothing
    expect(getRuntime().engine.stats().triggers).toBe(before + 1);
    registerPad(11, null);
  });

  test('choke-only pads silence the cymbal when the kit has no choke sample', async () => {
    const { getRuntime } = await import('@/app/runtime');
    const engine = getRuntime().engine;
    const spy = vi.spyOn(engine, 'choke');
    useMappingStore.setState((s) => ({
      mapping: {
        ...s.mapping,
        pads: s.mapping.pads.map((p) => (p.note === 39 ? { ...p, voice: 'crash.leftChoke' as const } : p)),
      },
    }));
    handleMidi(noteOn(39, 100), 0);
    expect(spy).toHaveBeenCalledWith('crash.leftChoke');
    expect(getLastHit()).toMatchObject({ voice: 'crash.leftChoke', articulationId: null });
  });
});
