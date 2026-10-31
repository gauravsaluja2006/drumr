import { getRuntime } from './runtime';
import { TEMP_PADS } from './tempMapping';
import { flashPad } from '@/ui/PadGrid/padFlash';

/**
 * Single entry point for every pad hit (keyboard, pointer; MIDI from Phase 3).
 * Synchronous: trigger audio first, then queue the visual flash for the next frame.
 */
export function hitPad(index: number, velocity: number, eventTime: number = performance.now()): void {
  const pad = TEMP_PADS[index];
  if (!pad) return;
  getRuntime().engine.trigger(pad.voice, velocity, eventTime);
  flashPad(index, velocity);
}
