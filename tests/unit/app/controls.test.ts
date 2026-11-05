import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { handleMidi, getLastHit } from '@/app/controller';
import { learnControl } from '@/app/controls';
import { resetRotation, useRotationStore } from '@/app/rotation';
import { setRuntime } from '@/app/runtime';
import { useControlsStore } from '@/state/useControlsStore';
import { useKitStore } from '@/state/useKitStore';
import { useMappingStore } from '@/state/useMappingStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useUiStore } from '@/state/useUiStore';
import { DEFAULT_CONTROLS } from '@/midi/controls';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
beforeEach(async () => {
  localStorage.clear();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  useKitStore.setState(initialKit, true);
  useControlsStore.setState(DEFAULT_CONTROLS);
  useMappingStore.getState().setPreset('maschine-logic');
  useSettingsStore.setState({ masterDb: 0, mix: {}, lastKitId: null });
  useUiStore.setState({ kitCursor: null });
  installFakeRuntime();
  await useKitStore.getState().init();
});
afterEach(() => {
  resetRotation();
  vi.unstubAllGlobals();
  setRuntime(null);
});

const cc = (controller: number, value: number, channel = 1) => ({
  type: 'cc' as const,
  channel,
  controller,
  value,
});
const noteOn = (note: number, velocity = 100) => ({ type: 'noteon' as const, channel: 1, note, velocity });
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('controller buttons and knobs', () => {
  test('learn binds the next button press; the button then switches kits and its release does nothing', async () => {
    const learned = vi.fn();
    learnControl('kit.next', learned);
    handleMidi(cc(20, 0), 0); // a release is not a press: still learning
    expect(learned).not.toHaveBeenCalled();
    handleMidi(cc(20, 127), 0);
    expect(learned).toHaveBeenCalledWith({
      action: 'kit.next',
      source: { kind: 'cc', channel: 1, number: 20 },
    });
    expect(useControlsStore.getState().bindings).toHaveLength(1);

    handleMidi(cc(20, 127), 0);
    await settle();
    expect(useKitStore.getState().currentKitId).toBe('kit-b');
    handleMidi(cc(20, 0), 0);
    await settle();
    expect(useKitStore.getState().currentKitId).toBe('kit-b');
  });

  test('a note bound to an action does not play its pad; other pads still play', () => {
    useControlsStore.getState().bind('rotation.toggle', { kind: 'note', channel: 1, number: 25 });
    const before = getLastHit();
    handleMidi(noteOn(25), 0);
    expect(getLastHit()).toBe(before);
    expect(useRotationStore.getState().running).toBe(true);
    handleMidi(noteOn(24), 0);
    expect(getLastHit()?.voice).toBe('kick');
  });

  test('knobs drive master, the current kit’s group gain, sensitivity and hardest hit', () => {
    const bind = useControlsStore.getState().bind;
    bind('mix.master', { kind: 'cc', channel: 1, number: 30 });
    bind('mix.snare', { kind: 'cc', channel: 1, number: 31 });
    bind('velocity.sensitivity', { kind: 'cc', channel: 1, number: 32 });
    bind('velocity.hardest', { kind: 'cc', channel: 1, number: 33 });
    handleMidi(cc(30, 0), 0);
    handleMidi(cc(31, 127), 0);
    handleMidi(cc(32, 127), 0);
    handleMidi(cc(33, 0), 0);
    expect(useSettingsStore.getState().masterDb).toBe(-60);
    expect(useSettingsStore.getState().mix['test-kit']?.snare?.db).toBe(6);
    expect(useMappingStore.getState().mapping.velocity).toMatchObject({ exponent: 4, ceiling: 32 });
  });

  test('the encoder moves the kit cursor and its push loads the highlighted kit', async () => {
    const bind = useControlsStore.getState().bind;
    bind('kitList.scroll', { kind: 'cc', channel: 1, number: 40 });
    bind('kitList.load', { kind: 'cc', channel: 1, number: 41 });
    handleMidi(cc(40, 1), 0); // two's complement +1
    expect(useUiStore.getState().kitCursor).toBe('kit-b');
    handleMidi(cc(40, 1), 0); // clamps at the end of the list
    expect(useUiStore.getState().kitCursor).toBe('kit-b');
    handleMidi(cc(41, 127), 0);
    await settle();
    expect(useKitStore.getState().currentKitId).toBe('kit-b');
    expect(useUiStore.getState().kitCursor).toBeNull();
  });

  test('program change selects the kit at that position unless turned off', async () => {
    handleMidi({ type: 'program', channel: 1, program: 1 }, 0);
    await settle();
    expect(useKitStore.getState().currentKitId).toBe('kit-b');
    useControlsStore.getState().set({ programChangeSelectsKit: false });
    handleMidi({ type: 'program', channel: 1, program: 0 }, 0);
    await settle();
    expect(useKitStore.getState().currentKitId).toBe('kit-b');
  });

  test('a CC bound to an action no longer moves the hi-hat', () => {
    const hihatCc = useMappingStore.getState().mapping.hihat.cc;
    useControlsStore.getState().bind('mix.master', { kind: 'cc', channel: 1, number: hihatCc });
    handleMidi(cc(hihatCc, 0), 0);
    expect(useSettingsStore.getState().masterDb).toBe(-60);
  });
});
