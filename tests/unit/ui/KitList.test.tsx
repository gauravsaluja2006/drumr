import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { KitList } from '@/ui/KitList/KitList';
import { DEFAULT_ROTATION } from '@/kits/rotation';
import { About } from '@/ui/About/About';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { setRuntime } from '@/app/runtime';
import { installFakeRuntime } from '../fakes/runtime';

const initialKit = useKitStore.getState();
beforeEach(async () => {
  localStorage.clear();
  useKitStore.setState(initialKit, true);
  useSettingsStore.setState({ masterDb: 0, lastKitId: null, rotation: DEFAULT_ROTATION });
  installFakeRuntime();
  await useKitStore.getState().init();
});
afterEach(() => setRuntime(null));

describe('KitList', () => {
  test('marks the playing kit and loads another on click', async () => {
    render(<KitList />);
    const list = screen.getByRole('list', { name: 'Drum kits' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByRole('button', { name: 'Test Kit' })).toHaveAttribute('aria-current', 'true');
    fireEvent.click(within(list).getByRole('button', { name: 'Kit B' }));
    await waitFor(() => expect(useKitStore.getState().currentKitId).toBe('kit-b'));
    expect(within(list).getByRole('button', { name: 'Kit B' })).toHaveAttribute('aria-current', 'true');
  });

  test('ticking kits picks the rotation shortlist', () => {
    render(<KitList />);
    expect(screen.getByTestId('rotation-hint')).toHaveTextContent('every kit');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rotate through Kit B' }));
    expect(useSettingsStore.getState().rotation.kitIds).toEqual(['kit-b']);
    expect(screen.getByTestId('rotation-hint')).toHaveTextContent('the 1 ticked kit');
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
