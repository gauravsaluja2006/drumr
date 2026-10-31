import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MidiBanner, MidiStatus } from '@/ui/MidiStatus/MidiStatus';
import { VelocityPanel } from '@/ui/VelocityPanel/VelocityPanel';
import { createRuntime, setRuntime } from '@/app/runtime';
import { bindMidiStore } from '@/state/useMidiStore';
import { useMappingStore } from '@/state/useMappingStore';
import { MidiManager } from '@/midi/MidiManager';
import { handleMidi } from '@/app/controller';
import { FakeAudioContext } from '../fakes/FakeAudioContext';
import { FakeMidiAccess, memoryStorage } from '../fakes/FakeMidi';

function withMidi(request: ConstructorParameters<typeof MidiManager>[0]) {
  const midi = new MidiManager(request, memoryStorage());
  setRuntime(
    createRuntime(
      new FakeAudioContext(),
      async () => ({
        ok: false,
        status: 404,
        json: async () => null,
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
      '/k/',
      midi,
    ),
  );
  const unbind = bindMidiStore(midi);
  return { midi, unbind };
}

afterEach(() => {
  setRuntime(null);
  vi.unstubAllGlobals();
});

describe('MidiStatus', () => {
  test('connected device shows its name; picker lists devices and deselects', async () => {
    const access = new FakeMidiAccess();
    access.add('m', 'Maschine MK3');
    access.add('k', 'Keyboard');
    const { midi } = withMidi(async () => access);
    await act(() => midi.init());
    render(<MidiStatus />);
    expect(screen.getByTestId('midi-status')).toHaveTextContent('Hit a pad to connect…');
    fireEvent.click(screen.getByTestId('midi-status'));
    expect(screen.getByRole('menu')).toHaveTextContent(/Hit any pad on your controller/);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Maschine MK3' }));
    expect(screen.getByTestId('midi-status')).toHaveTextContent('Connected · Maschine MK3');
    fireEvent.click(screen.getByTestId('midi-status'));
    expect(screen.getByRole('menuitemradio', { name: 'Maschine MK3' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Maschine MK3' }));
    expect(screen.getByTestId('midi-status')).toHaveAttribute('data-status', 'no-device');
    expect(screen.getByTestId('midi-status')).toHaveTextContent('Choose MIDI device…'); // explicit disconnect: not listening
    fireEvent.click(screen.getByTestId('midi-status'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('unsupported and denied states show banners; Retry re-requests access', async () => {
    const { midi, unbind } = withMidi(undefined);
    await act(() => midi.init());
    const { unmount } = render(
      <>
        <MidiStatus />
        <MidiBanner />
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/isn’t supported/);
    fireEvent.click(screen.getByTestId('midi-status'));
    expect(screen.getByRole('menu')).toHaveTextContent(/no Web MIDI/);
    unmount();
    unbind();

    let calls = 0;
    const denied = withMidi(async () => {
      calls++;
      throw Object.assign(new Error('no'), { name: 'NotAllowedError' });
    });
    await act(() => denied.midi.init());
    render(
      <>
        <MidiStatus />
        <MidiBanner />
      </>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/blocked/);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry' })));
    expect(calls).toBe(2);
    fireEvent.click(screen.getByTestId('midi-status'));
    await act(async () => fireEvent.click(screen.getByRole('menuitem', { name: 'Retry' })));
    expect(calls).toBe(3);
  });
});

describe('VelocityPanel', () => {
  test('edits the curve and plots the last MIDI hit', async () => {
    useMappingStore.getState().setPreset('maschine-logic');
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    withMidi(undefined);
    render(<VelocityPanel />);
    fireEvent.change(screen.getByLabelText('Curve'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Floor'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Floor'), { target: { value: '99' } }); // out of range: ignored
    expect(useMappingStore.getState().mapping.velocity).toEqual({ exponent: 3, floor: 10 });
    await act(async () => {
      handleMidi({ type: 'noteon', channel: 1, note: 24, velocity: 64 }, 0);
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(screen.getByText(/last hit 64 → 101/)).toBeInTheDocument();
  });
});
