/** Computer-keyboard input: 1234 / qwer / asdf / zxcv → pads 0..15, top row first (US-02). */
export const KEYBOARD_ROWS = ['1234', 'qwer', 'asdf', 'zxcv'] as const;
export const KEYBOARD_VELOCITY = 100;

const KEY_TO_PAD = new Map<string, number>(
  KEYBOARD_ROWS.flatMap((row, r) => [...row].map((key, c) => [key, r * row.length + c] as const)),
);

export function keyToPad(key: string): number | null {
  return KEY_TO_PAD.get(key.toLowerCase()) ?? null;
}

export function keyHintFor(index: number): string {
  for (const [key, pad] of KEY_TO_PAD) if (pad === index) return key.toUpperCase();
  return '';
}

export type HitHandler = (padIndex: number, velocity: number, eventTime: number) => void;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function attachKeyboard(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  onHit: HitHandler,
) {
  const handler = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
    const pad = keyToPad(e.key);
    if (pad === null) return;
    e.preventDefault();
    onHit(pad, KEYBOARD_VELOCITY, performance.now());
  };
  target.addEventListener('keydown', handler as EventListener);
  return () => target.removeEventListener('keydown', handler as EventListener);
}
