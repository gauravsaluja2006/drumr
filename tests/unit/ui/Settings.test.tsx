import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '@/ui/Settings/Settings';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useUiStore } from '@/state/useUiStore';
import { testManifest } from '../fakes/kits';

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ fx: {}, fxDefault: null, mix: {}, humanize: true });
  useUiStore.setState({ settings: 'sound', editing: false });
  useKitStore.setState({ currentKitId: 'test-kit', manifest: testManifest() });
});

describe('settings', () => {
  test('sound: tune and length per drum for this kit, natural variation, reset to recommended', async () => {
    render(<Settings />);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    const tune = screen.getByRole('slider', { name: 'Snare tune' });
    tune.focus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(tune).toHaveAttribute('aria-valuetext', '+2 st');
    const length = screen.getByRole('slider', { name: 'Snare length' });
    expect(length).toHaveAttribute('aria-valuetext', 'Natural');
    length.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(useSettingsStore.getState().mix['test-kit']?.snare).toMatchObject({ tune: 2, decay: 0.95 });
    // Only the kit's own groups are listed.
    expect(screen.queryByRole('slider', { name: 'Toms tune' })).toBeNull();

    await userEvent.click(screen.getByRole('checkbox', { name: /Natural variation/ }));
    expect(useSettingsStore.getState().humanize).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /to its recommended sound/ }));
    expect(useSettingsStore.getState().mix['test-kit']).toBeUndefined();
    expect(screen.getByRole('slider', { name: 'Snare tune' })).toHaveAttribute('aria-valuetext', '0 st');
  });

  test('playing tab holds pad feel, hi-hat and layout; Edit layout closes settings and opens the editor', async () => {
    render(<Settings />);
    await userEvent.click(screen.getByRole('tab', { name: 'Playing' }));
    expect(screen.getByRole('slider', { name: 'Hardest hit' })).toBeInTheDocument();
    expect(screen.getByLabelText('Controller')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Edit layout/ }));
    expect(useUiStore.getState()).toMatchObject({ settings: null, editing: true });
  });

  test('controller tab holds MIDI learn', async () => {
    render(<Settings />);
    await userEvent.click(screen.getByRole('tab', { name: 'Controller' }));
    expect(screen.getByRole('button', { name: 'Learn Next kit' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(useUiStore.getState().settings).toBeNull();
  });
});
