import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoreMenu } from '@/ui/StatusBar/MoreMenu';
import { useUiStore } from '@/state/useUiStore';

beforeEach(() => useUiStore.setState({ aboutOpen: false, debugOpen: false }));

describe('header menu', () => {
  test('opens About and the debug panel; arrows move, Escape closes and returns focus', async () => {
    render(<MoreMenu />);
    const more = screen.getByRole('button', { name: 'More' });
    await userEvent.click(more);
    expect(screen.getByRole('menuitem', { name: 'About & licences' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /Debug panel/ })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveFocus();

    await userEvent.click(more);
    await userEvent.click(screen.getByRole('menuitem', { name: 'About & licences' }));
    expect(useUiStore.getState().aboutOpen).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(more);
    await userEvent.click(screen.getByRole('menuitem', { name: /Debug panel/ }));
    expect(useUiStore.getState().debugOpen).toBe(true);
  });
});
