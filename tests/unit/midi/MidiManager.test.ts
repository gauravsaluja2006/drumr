import { describe, expect, test, vi } from 'vitest';
import { LAST_DEVICE_KEY, MidiManager } from '@/midi/MidiManager';
import type { MidiMessage } from '@/midi/types';
import { FakeMidiAccess, memoryStorage } from '../fakes/FakeMidi';

function setup(prefill: (a: FakeMidiAccess) => void = () => {}) {
  const access = new FakeMidiAccess();
  prefill(access);
  const storage = memoryStorage();
  let t = 100;
  const manager = new MidiManager(
    async () => access,
    storage,
    () => t++,
  );
  const messages: [MidiMessage, number][] = [];
  manager.onMessage = (m, time) => messages.push([m, time]);
  return { access, storage, manager, messages };
}

describe('MidiManager', () => {
  test('P3: MidiManager auto-selects the only input and emits connected state', async () => {
    const { manager, messages, access } = setup((a) => a.add('pad-1', 'Maschine Mikro MK3'));
    const states: string[] = [];
    manager.subscribe((s) => states.push(s.status));
    await manager.init();
    expect(manager.getState()).toMatchObject({
      status: 'connected',
      selectedId: 'pad-1',
      inputs: [{ id: 'pad-1', name: 'Maschine Mikro MK3' }],
    });
    expect(states).toContain('pending');
    expect(states.at(-1)).toBe('connected');
    access.map.get('pad-1')!.send([0x90, 25, 100]);
    expect(messages).toEqual([[{ type: 'noteon', channel: 1, note: 25, velocity: 100 }, 100]]);
    access.map.get('pad-1')!.send([0xf8]);
    expect(messages).toHaveLength(1);
  });

  test('P3: MidiManager handles hot-plug add/remove and falls back to "no device"', async () => {
    const { manager, access } = setup();
    await manager.init();
    expect(manager.getState()).toMatchObject({ status: 'no-device', inputs: [] });
    access.add('a', null);
    expect(manager.getState()).toMatchObject({
      status: 'connected',
      selectedId: 'a',
      inputs: [{ id: 'a', name: 'Unnamed MIDI device' }],
    });
    access.add('b', 'Second');
    expect(manager.getState().selectedId).toBe('a'); // keeps the current device
    access.remove('a');
    expect(manager.getState()).toMatchObject({ status: 'connected', selectedId: 'b' }); // only one left → auto-select
    access.remove('b');
    expect(manager.getState()).toMatchObject({ status: 'no-device', selectedId: null, inputs: [] });
  });

  test('with several devices nothing is auto-selected until the user picks one', async () => {
    const { manager, access, messages } = setup((a) => {
      a.add('a');
      a.add('b');
    });
    await manager.init();
    expect(manager.getState()).toMatchObject({ status: 'no-device', selectedId: null });
    manager.select('b');
    access.map.get('a')!.send([0x90, 1, 1]);
    access.map.get('b')!.send([0x90, 2, 2]);
    expect(messages.map(([m]) => (m.type === 'noteon' ? m.note : -1))).toEqual([2]);
    manager.select('a');
    expect(access.map.get('b')!.onmidimessage).toBeNull();
    manager.select(null);
    expect(manager.getState().status).toBe('no-device');
  });

  test('P3: MidiManager remembers last device id and reselects it on reconnect', async () => {
    const { manager, access, storage } = setup((a) => {
      a.add('a');
      a.add('b');
    });
    await manager.init();
    manager.select('b');
    expect(storage.data.get(LAST_DEVICE_KEY)).toBe('b');
    access.remove('b');
    expect(manager.getState().selectedId).toBe('a'); // only device left
    access.add('b');
    expect(manager.getState().selectedId).toBe('a'); // current device still connected: keep it
    access.remove('a');
    access.add('c');
    expect(manager.getState().selectedId).toBe('b'); // remembered beats "first of several"
  });

  test('reports unsupported, denied and other errors', async () => {
    const unsupported = new MidiManager(undefined, null);
    await unsupported.init();
    expect(unsupported.getState().status).toBe('unsupported');

    const denied = new MidiManager(async () => {
      throw Object.assign(new Error('blocked'), { name: 'SecurityError' });
    }, null);
    await denied.init();
    expect(denied.getState()).toMatchObject({ status: 'denied', error: 'blocked' });

    const broken = new MidiManager(() => Promise.reject('boom'), null);
    await broken.init();
    expect(broken.getState()).toMatchObject({ status: 'error', error: 'boom' });

    const listener = vi.fn();
    const off = broken.subscribe(listener);
    off();
    await broken.init();
    expect(listener).not.toHaveBeenCalled();
  });
});
