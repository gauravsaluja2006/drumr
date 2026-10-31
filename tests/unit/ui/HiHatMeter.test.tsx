import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HiHatMeter } from '@/ui/HiHatMeter/HiHatMeter';
import { handleMidi, hihat } from '@/app/controller';
import { setRuntime } from '@/app/runtime';
import { useKitStore } from '@/state/useKitStore';
import { useMappingStore } from '@/state/useMappingStore';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
beforeEach(async () => {
  localStorage.clear();
  useKitStore.setState(initialKit, true);
  useMappingStore.getState().setPreset('maschine-logic');
  hihat.value = null;
  installFakeRuntime();
  await useKitStore.getState().init();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});
afterEach(() => {
  vi.unstubAllGlobals();
  setRuntime(null);
});

describe('HiHatMeter', () => {
  test('follows CC and edits hi-hat settings', async () => {
    render(<HiHatMeter />);
    const meter = screen.getByRole('meter', { name: 'Hi-hat openness' });
    expect(meter).toHaveAttribute('aria-valuenow', '6');
    expect(screen.getByTestId('hihat-level')).toHaveTextContent('Open');
    expect(screen.getByText('no CC yet')).toBeInTheDocument();

    await act(async () => {
      handleMidi({ type: 'cc', channel: 1, controller: 1, value: 5 }, 0);
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByTestId('hihat-level')).toHaveTextContent('Closed');
    expect(screen.getByText('CC 1 = 5')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('High value opens the hat')); // invert off: low CC = open
    expect(useMappingStore.getState().mapping.hihat.invert).toBe(false);
    expect(meter).toHaveAttribute('aria-valuenow', '6');
    fireEvent.change(screen.getByLabelText('Controller'), { target: { value: '4' } });
    expect(useMappingStore.getState().mapping.hihat.cc).toBe(4);
    fireEvent.click(screen.getByLabelText(/Pedal “chick”/));
    expect(useMappingStore.getState().mapping.hihat.pedalOnClose).toBe(true);
  });

  test('shows a custom CC number not in the list', () => {
    useMappingStore.getState().setHihat({ cc: 21 });
    render(<HiHatMeter />);
    expect(screen.getByRole('option', { name: /CC 21 · CC 21/ })).toBeInTheDocument();
  });
});
