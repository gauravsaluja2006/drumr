import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '@/app/App';
import { setRuntime } from '@/app/runtime';
import { hitPad } from '@/app/controller';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { installFakeRuntime } from '../fakes/runtime';
import type { FakeGain } from '../fakes/FakeAudioContext';

const initialKit = useKitStore.getState();

beforeEach(() => {
  localStorage.clear();
  useKitStore.setState(initialKit, true);
  useSettingsStore.setState({ masterDb: 0, lastKitId: null });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => {
  vi.unstubAllGlobals();
  setRuntime(null);
});

describe('App with a fake runtime', () => {
  test('loads the default kit, then keyboard and pointer hits trigger the engine', async () => {
    const rt = installFakeRuntime();
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('kit-name')).toHaveTextContent('Test Kit'));
    // Maschine layout: bottom-left pad (key "z", note 24) is the kick.
    expect(screen.getByRole('button', { name: 'Pad 13: Kick, note 24' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Pad 1: Crash L.*not in this kit/ })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'z' });
    expect(rt.engine.stats().lastTrigger).toMatchObject({ articulationId: 'kick', velocity: 100 });
    fireEvent.keyDown(window, { key: 'x' });
    expect(rt.engine.stats().lastTrigger?.articulationId).toBe('snare.center');
    fireEvent.keyDown(window, { key: '1' }); // crash: not in the test kit, nothing plays
    expect(rt.engine.stats().triggers).toBe(2);
  });

  test('master slider drives the engine master gain', async () => {
    const rt = installFakeRuntime();
    render(<App />);
    await waitFor(() => expect(useKitStore.getState().status).toBe('ready'));
    fireEvent.change(screen.getByRole('slider', { name: 'Master' }), { target: { value: '-6' } });
    expect((rt.engine.master as FakeGain).gain.target).toBeCloseTo(0.501, 3);
  });

  test('audio overlay shows while suspended and resumes on interaction', async () => {
    const rt = installFakeRuntime();
    rt.ctx.state = 'suspended';
    render(<App />);
    expect(screen.getByTestId('audio-overlay')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(window);
    });
    await waitFor(() => expect(screen.queryByTestId('audio-overlay')).not.toBeInTheDocument());
  });

  test('audio overlay never blocks the app when resume cannot start audio (no output device)', async () => {
    const rt = installFakeRuntime();
    rt.ctx.state = 'suspended';
    rt.ctx.resume = async () => {
      throw new Error('no device');
    };
    render(<App />);
    expect(screen.getByTestId('audio-overlay')).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'x' });
    });
    expect(screen.queryByTestId('audio-overlay')).not.toBeInTheDocument();
    expect(rt.ctx.state).toBe('suspended');
  });

  test('hitPad ignores pads outside the grid', () => {
    const rt = installFakeRuntime();
    hitPad(99, 100);
    expect(rt.engine.stats().triggers).toBe(0);
  });

  test('without Web Audio the kit panel shows an error', async () => {
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Web Audio/);
  });
});

describe('mixer', () => {
  test('group sliders and mutes drive engine group gains for the current kit', async () => {
    const rt = installFakeRuntime();
    render(<App />);
    await waitFor(() => expect(useKitStore.getState().status).toBe('ready'));
    // Test kit groups: kick, snare, hihat (no toms/cymbals/perc sliders).
    expect(screen.queryByRole('slider', { name: 'Toms' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Hi-hat' }), { key: 'PageDown' });
    expect(rt.engine.gainDb.hihat).toBe(-6);
    fireEvent.click(screen.getByRole('button', { name: 'Mute Kick' }));
    expect(rt.engine.gainDb.kick).toBe(-Infinity);
    expect((rt.engine.groups.kick as FakeGain).gain.target).toBe(0);
    expect(useSettingsStore.getState().mix['test-kit']).toEqual({
      hihat: { db: -6, muted: false },
      kick: { db: 0, muted: true },
    });
  });
});
