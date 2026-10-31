import { afterEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PadGrid } from '@/ui/PadGrid/PadGrid';
import { flashPad } from '@/ui/PadGrid/padFlash';

describe('PadGrid', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('P1: PadGrid sets data-hit and --v on a pad within one rAF of a PadHit', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    render(<PadGrid />);
    const pad = document.querySelector<HTMLElement>('[data-pad="5"]')!;

    flashPad(5, 127);
    flashPad(5, 64); // coalesced into the same frame, last velocity wins
    expect(pad.hasAttribute('data-hit')).toBe(false);
    expect(frames).toHaveLength(1);

    frames.shift()!(0);
    expect(pad.hasAttribute('data-hit')).toBe(true);
    expect(pad.style.getPropertyValue('--v')).toBe('0.504');
    expect(pad.dataset.hitCount).toBe('1');

    flashPad(5, 127);
    frames.shift()!(0);
    expect(pad.style.getPropertyValue('--v')).toBe('1.000');
    expect(pad.dataset.hitCount).toBe('2');

    fireEvent.animationEnd(pad);
    expect(pad.hasAttribute('data-hit')).toBe(false);
  });

  test('pointer down hits with position velocity; keyboard activation hits at 100; disabled does nothing', () => {
    const onHit = vi.fn();
    const { rerender } = render(<PadGrid pads={[{ label: 'Kick', note: 36 }]} onHit={onHit} />);
    const pad = screen.getByRole('button', { name: 'Pad 1: Kick, note 36' });
    vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 100 } as DOMRect);
    fireEvent.pointerDown(pad, { clientY: 100, button: 0 });
    expect(onHit).toHaveBeenLastCalledWith(0, 127, expect.any(Number));
    fireEvent.click(pad, { detail: 1 }); // mouse click after pointerdown: ignored
    expect(onHit).toHaveBeenCalledTimes(1);
    fireEvent.click(pad, { detail: 0 }); // Enter/Space
    expect(onHit).toHaveBeenLastCalledWith(0, 100, expect.any(Number));

    rerender(<PadGrid pads={[{ label: 'Kick' }]} onHit={onHit} disabled />);
    fireEvent.pointerDown(pad, { clientY: 10, button: 0 });
    expect(onHit).toHaveBeenCalledTimes(2);
  });

  test('unavailable pads are marked and announced', () => {
    render(<PadGrid pads={[{ label: 'Tom', unavailable: true }]} />);
    const pad = screen.getByRole('button', { name: /Tom.*not in this kit/ });
    expect(pad).toHaveAttribute('data-unavailable');
    expect(pad).toHaveAttribute('title', 'Not in this kit');
  });
});
