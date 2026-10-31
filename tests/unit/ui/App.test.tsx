import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '@/app/App';
import { keyHintFor } from '@/ui/PadGrid/padLayout';

describe('App shell', () => {
  test('P0: app renders status bar and 16 pads', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent('Drumr');
    const grid = screen.getByRole('group', { name: 'Drum pads' });
    expect(grid.querySelectorAll('button[data-pad]')).toHaveLength(16);
  });

  test('keyboard hints run 1234/qwer/asdf/zxcv top to bottom', () => {
    expect([0, 3, 4, 15].map(keyHintFor)).toEqual(['1', '4', 'Q', 'V']);
  });
});
