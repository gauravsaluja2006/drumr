import { describe, expect, test, vi } from 'vitest';
import { attachKeyboard, keyHintFor, keyToPad } from '@/input/keyboard';
import { velocityFromPosition } from '@/input/pointer';

describe('keyboard input', () => {
  test('P1: keyboard key "1" maps to pad 0 and "v" maps to pad 15', () => {
    expect(keyToPad('1')).toBe(0);
    expect(keyToPad('v')).toBe(15);
    expect(keyToPad('Q')).toBe(4);
    expect(keyToPad('p')).toBeNull();
    expect(keyHintFor(15)).toBe('V');
    expect(keyHintFor(99)).toBe('');
  });

  test('attachKeyboard fires hits and ignores repeats, modifiers and inputs', () => {
    const onHit = vi.fn();
    const detach = attachKeyboard(window, onHit);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onHit).toHaveBeenCalledWith(5, 100, expect.any(Number));
    detach();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    expect(onHit).toHaveBeenCalledTimes(1);
    input.remove();
  });

  test('pointer velocity runs 60 at the top to 127 at the bottom', () => {
    expect(velocityFromPosition(0, 100)).toBe(60);
    expect(velocityFromPosition(100, 100)).toBe(127);
    expect(velocityFromPosition(50, 100)).toBe(94);
    expect(velocityFromPosition(500, 100)).toBe(127);
    expect(velocityFromPosition(10, 0)).toBe(100);
  });
});
