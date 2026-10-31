import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DbSlider, formatDb } from '@/ui/primitives/Slider';

describe('DbSlider', () => {
  test('formatDb', () => {
    expect(formatDb(0)).toBe('0.0 dB');
    expect(formatDb(-6)).toBe('−6.0 dB');
    expect(formatDb(3.5)).toBe('+3.5 dB');
    expect(formatDb(-60)).toBe('−∞ dB');
  });

  test('reports aria-valuetext, changes, and resets on double-click', () => {
    const onChange = vi.fn();
    render(<DbSlider label="Master" value={-6} defaultValue={0} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Master' });
    expect(slider).toHaveAttribute('aria-valuetext', '−6.0 dB');
    fireEvent.change(slider, { target: { value: '-12' } });
    expect(onChange).toHaveBeenLastCalledWith(-12);
    fireEvent.doubleClick(slider);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
