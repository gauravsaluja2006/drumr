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

describe('DbSlider keyboard and mute', () => {
  test('P6: Slider is keyboard operable and reports aria-valuetext in dB', () => {
    const values: number[] = [];
    const { rerender } = render(
      <DbSlider label="Toms" value={-6} min={-60} max={6} step={0.5} onChange={(v) => values.push(v)} />,
    );
    const slider = screen.getByRole('slider', { name: 'Toms' });
    expect(slider).toHaveAttribute('aria-valuetext', '−6.0 dB');
    for (const key of [
      'ArrowUp',
      'ArrowRight',
      'ArrowDown',
      'ArrowLeft',
      'PageUp',
      'PageDown',
      'Home',
      'End',
    ])
      fireEvent.keyDown(slider, { key });
    expect(values).toEqual([-5.5, -5.5, -6.5, -6.5, 0, -12, -60, 6]);
    fireEvent.keyDown(slider, { key: 'q' }); // pad keys pass through untouched
    expect(values).toHaveLength(8);

    rerender(<DbSlider label="Toms" value={6} onChange={(v) => values.push(v)} />);
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(values.at(-1)).toBe(6); // clamped
    rerender(<DbSlider label="Toms" value={-60} onChange={() => {}} />);
    expect(slider).toHaveAttribute('aria-valuetext', '−∞ dB');
  });

  test('mute toggle reports state', () => {
    const onMute = vi.fn();
    const { rerender } = render(
      <DbSlider label="Kick" value={-3} muted={false} onMuteChange={onMute} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mute Kick' }));
    expect(onMute).toHaveBeenCalledWith(true);
    rerender(<DbSlider label="Kick" value={-3} muted onMuteChange={onMute} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Mute Kick' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('slider', { name: 'Kick' })).toHaveAttribute('aria-valuetext', 'muted (−3.0 dB)');
  });
});
