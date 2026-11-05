import { describe, expect, test } from 'vitest';
import {
  actionKind,
  ControlsConfigSchema,
  DEFAULT_CONTROLS,
  encoderDelta,
  isPress,
  knobToDb,
  knobToRange,
  matchesKind,
  sourceKey,
  sourceOf,
  withBinding,
} from '@/midi/controls';

const cc = (controller: number, value: number, channel = 1) => ({
  type: 'cc' as const,
  channel,
  controller,
  value,
});
const noteOn = (note: number, velocity = 100, channel = 1) => ({
  type: 'noteon' as const,
  channel,
  note,
  velocity,
});

describe('MIDI controls', () => {
  test('sourceOf identifies CC and note sources by channel and number; key is unique per source', () => {
    expect(sourceOf(cc(20, 64, 2))).toEqual({ kind: 'cc', channel: 2, number: 20 });
    expect(sourceOf(noteOn(36))).toEqual({ kind: 'note', channel: 1, number: 36 });
    expect(sourceOf({ type: 'noteoff', channel: 1, note: 36, velocity: 0 })).toEqual({
      kind: 'note',
      channel: 1,
      number: 36,
    });
    expect(sourceOf({ type: 'program', channel: 1, program: 3 })).toBeNull();
    const keys = new Set([
      sourceKey({ kind: 'cc', channel: 1, number: 20 }),
      sourceKey({ kind: 'note', channel: 1, number: 20 }),
      sourceKey({ kind: 'cc', channel: 2, number: 20 }),
      sourceKey({ kind: 'cc', channel: 1, number: 21 }),
    ]);
    expect(keys.size).toBe(4);
  });

  test('a button press is a note-on or a CC above 0; releases are not presses', () => {
    expect(isPress(noteOn(36))).toBe(true);
    expect(isPress({ type: 'noteoff', channel: 1, note: 36, velocity: 0 })).toBe(false);
    expect(isPress(cc(20, 127))).toBe(true);
    expect(isPress(cc(20, 0))).toBe(false);
  });

  test('learn accepts notes and CCs for buttons, only CCs for knobs and encoders', () => {
    expect(actionKind('kit.next')).toBe('button');
    expect(actionKind('mix.snare')).toBe('knob');
    expect(actionKind('kitList.scroll')).toBe('encoder');
    expect(matchesKind('button', noteOn(36))).toBe(true);
    expect(matchesKind('button', cc(20, 127))).toBe(true);
    expect(matchesKind('button', cc(20, 0))).toBe(false); // the release after a learn press
    expect(matchesKind('knob', noteOn(36))).toBe(false);
    expect(matchesKind('knob', cc(20, 0))).toBe(true);
    expect(matchesKind('encoder', cc(20, 1))).toBe(true);
  });

  test('withBinding moves a source to the new action and replaces the action’s old source', () => {
    const src = { kind: 'cc' as const, channel: 1, number: 20 };
    let b = withBinding([], 'kit.next', src);
    expect(b).toEqual([{ action: 'kit.next', source: src }]);
    b = withBinding(b, 'kit.prev', src); // same control reassigned
    expect(b).toEqual([{ action: 'kit.prev', source: src }]);
    b = withBinding(b, 'kit.prev', { kind: 'note', channel: 1, number: 40 });
    expect(b).toEqual([{ action: 'kit.prev', source: { kind: 'note', channel: 1, number: 40 } }]);
    expect(withBinding(b, 'kit.prev', null)).toEqual([]);
  });

  test('encoderDelta decodes two’s-complement, offset-64 and absolute encoders', () => {
    expect(encoderDelta(1, 'relative')).toBe(1);
    expect(encoderDelta(3, 'relative')).toBe(3);
    expect(encoderDelta(127, 'relative')).toBe(-1);
    expect(encoderDelta(125, 'relative')).toBe(-3);
    expect(encoderDelta(65, 'offset')).toBe(1);
    expect(encoderDelta(63, 'offset')).toBe(-1);
    expect(encoderDelta(64, 'offset')).toBe(0);
    expect(encoderDelta(70, 'absolute', 68)).toBe(2);
    expect(encoderDelta(66, 'absolute', 68)).toBe(-2);
    expect(encoderDelta(66, 'absolute', undefined)).toBe(0);
  });

  test('knob values map onto ranges; dB knobs put 0 dB about 70 % up and −∞ at the bottom', () => {
    expect(knobToRange(0, 32, 127)).toBe(32);
    expect(knobToRange(127, 32, 127)).toBe(127);
    expect(knobToRange(64, 0, 100)).toBe(50);
    expect(knobToDb(127)).toBe(6);
    expect(knobToDb(0)).toBe(-60);
    expect(knobToDb(89)).toBe(0);
    const steps = Array.from({ length: 128 }, (_, v) => knobToDb(v));
    expect(steps.every((d, i) => i === 0 || d >= steps[i - 1]!)).toBe(true); // monotonic
    expect(steps.every((d) => Number.isInteger(d * 2))).toBe(true); // 0.5 dB steps
  });

  test('ControlsConfigSchema accepts the defaults and drops unknown actions', () => {
    expect(ControlsConfigSchema.parse(DEFAULT_CONTROLS)).toEqual(DEFAULT_CONTROLS);
    const parsed = ControlsConfigSchema.safeParse({
      ...DEFAULT_CONTROLS,
      bindings: [{ action: 'self.destruct', source: { kind: 'cc', channel: 1, number: 1 } }],
    });
    expect(parsed.success).toBe(false);
  });
});
