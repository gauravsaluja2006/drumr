import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KitSelector } from '@/ui/KitSelector/KitSelector';
import { About } from '@/ui/About/About';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { setRuntime } from '@/app/runtime';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
beforeEach(async () => {
  localStorage.clear();
  useKitStore.setState(initialKit, true);
  useSettingsStore.setState({ masterDb: 0, lastKitId: null });
  installFakeRuntime();
  await useKitStore.getState().init();
});
afterEach(() => setRuntime(null));

describe('KitSelector', () => {
  test('shows the current kit and switches with the keyboard', async () => {
    render(<KitSelector />);
    const button = screen.getByRole('button', { name: /Test Kit/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const list = await screen.findByRole('listbox', { name: 'Drum kits' });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('option', { name: /Test Kit/ })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getAllByText('CC0-1.0').length).toBeGreaterThan(0));

    const keydown = vi.fn();
    window.addEventListener('keydown', keydown);
    fireEvent.keyDown(list, { key: 'q' }); // pad keys must not leak out of the open list
    window.removeEventListener('keydown', keydown);
    expect(keydown).not.toHaveBeenCalled();

    fireEvent.keyDown(list, { key: 'End' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await waitFor(() => expect(useKitStore.getState().currentKitId).toBe('kit-b'));
    expect(button).toHaveFocus();
  });

  test('mouse selection, Escape, and outside click close the list', async () => {
    render(<KitSelector />);
    const button = screen.getByRole('button', { name: /Test Kit/ });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Home' });
    fireEvent.click(screen.getByRole('option', { name: /Kit B/ }));
    await waitFor(() => expect(useKitStore.getState().currentKitId).toBe('kit-b'));
  });
});

describe('About', () => {
  test('lists every kit with author and licence links; Escape closes', async () => {
    const onClose = vi.fn();
    render(<About open onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'About Drumr' });
    expect(dialog).toHaveFocus();
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'CC0-1.0' })).toHaveLength(2));
    expect(screen.getAllByRole('link', { name: 'Drumr tests' })[0]).toHaveAttribute(
      'href',
      'https://example.com/',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('renders nothing when closed', () => {
    render(<About open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
