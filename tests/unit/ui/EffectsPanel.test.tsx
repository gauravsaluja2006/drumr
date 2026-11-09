import { beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffectsPanel, SoundQuick } from '@/ui/EffectsPanel/EffectsPanel';
import { useKitStore } from '@/state/useKitStore';
import { fxFor, useSettingsStore } from '@/state/useSettingsStore';
import { useUiStore } from '@/state/useUiStore';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ fx: {}, fxDefault: null, mix: {} });
  useUiStore.setState({ settings: null });
  useKitStore.setState({ currentKitId: 'kit-a', manifest: null });
});

describe('effects', () => {
  test('home toggles start from the recommended room and hall, and open the full controls', async () => {
    render(<SoundQuick />);
    expect(screen.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hall' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Echo' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('fx-source')).toHaveTextContent('Recommended');
    await userEvent.click(screen.getByRole('button', { name: 'Echo' }));
    expect(fxFor(useSettingsStore.getState(), 'kit-a').echo.on).toBe(true);
    expect(screen.getByTestId('fx-source')).toHaveTextContent('Your mix');
    await userEvent.click(screen.getByRole('button', { name: 'Tune & effects…' }));
    expect(useUiStore.getState().settings).toBe('sound');
  });

  test('full controls set amounts per kit and copy them to every kit', async () => {
    render(<EffectsPanel />);
    expect(screen.getByText('Recommended for this kit')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('slider', { name: 'Plate amount' }), { target: { value: '60' } });
    const s = useSettingsStore.getState();
    expect(fxFor(s, 'kit-a').plate).toEqual({ on: true, amount: 0.6 });
    expect(fxFor(s, 'kit-b').plate.on).toBe(false); // other kits untouched

    await userEvent.click(screen.getByRole('button', { name: 'Use on all kits' }));
    expect(fxFor(useSettingsStore.getState(), 'kit-b').plate).toEqual({ on: true, amount: 0.6 });
    expect(screen.getByText('Same on every kit')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider', { name: 'Plate amount' }), { target: { value: '0' } });
    expect(fxFor(useSettingsStore.getState(), 'kit-a').plate.on).toBe(false);
  });
});
