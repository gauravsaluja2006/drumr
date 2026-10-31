import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PadGrid } from '@/ui/PadGrid/PadGrid';
import { flashPad, flushPadFlash } from '@/ui/PadGrid/padFlash';
import { prefersReducedMotion, REDUCED_MOTION } from '@/app/media';

function mockMatchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === REDUCED_MOTION ? reduced : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('reduced motion', () => {
  test('P7: reduced motion disables glow and scale', () => {
    vi.stubGlobal('requestAnimationFrame', () => 0);
    render(<PadGrid />);
    const pad = document.querySelector<HTMLElement>('[data-pad="3"]')!;

    mockMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
    flashPad(3, 127);
    flushPadFlash();
    expect(pad.getAttribute('data-hit')).toBe('a'); // full animation: glow + scale
    flashPad(3, 127);
    flushPadFlash();
    expect(pad.getAttribute('data-hit')).toBe('b'); // alternates to restart without a layout flush

    mockMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    flashPad(3, 127);
    flushPadFlash();
    // CSS: .pad[data-hit^='reduced'] has no press (scale/glow) animation, only a one-frame colour flash.
    expect(pad.getAttribute('data-hit')).toBe('reduced-a');
  });
});
