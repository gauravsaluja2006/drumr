import { beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffectsPanel } from '@/ui/EffectsPanel/EffectsPanel';
import { useKitStore } from '@/state/useKitStore';
import { DEFAULT_FX } from '@/engine/Effects';
import { fxFor, useSettingsStore } from '@/state/useSettingsStore';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ fx: {}, fxDefault: DEFAULT_FX });
  useKitStore.setState({ currentKitId: 'kit-a', manifest: null });
});

describe('effects panel', () => {
  test('switches effects on per kit, sets the amount, and copies them to every kit', async () => {
    render(<EffectsPanel />);
    expect(screen.getByText('Same on every kit')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Echo' }));
    expect(screen.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByRole('slider', { name: 'Hall amount' }), { target: { value: '60' } });
    const s = useSettingsStore.getState();
    expect(fxFor(s, 'kit-a')).toMatchObject({
      room: { on: true },
      hall: { on: true, amount: 0.6 },
      echo: { on: true },
      plate: { on: false },
    });
    expect(fxFor(s, 'kit-b').room.on).toBe(false); // other kits untouched

    await userEvent.click(screen.getByRole('button', { name: 'Use on all kits' }));
    expect(fxFor(useSettingsStore.getState(), 'kit-b').hall).toEqual({ on: true, amount: 0.6 });
    expect(screen.getByText('Same on every kit')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider', { name: 'Hall amount' }), { target: { value: '0' } });
    expect(fxFor(useSettingsStore.getState(), 'kit-a').hall.on).toBe(false);
  });
});
