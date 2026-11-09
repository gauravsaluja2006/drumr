import { z } from 'zod';
import type { MidiMessage } from './types';

/**
 * Controller buttons, knobs and encoders bound to app actions by MIDI learn. Pure data and
 * decoding; src/app/controls.ts dispatches the actions.
 */
export const BUTTON_ACTIONS = [
  'kit.next',
  'kit.prev',
  'rotation.toggle',
  'tempo.tap',
  'layout.next',
  'kitList.load',
  'loop.record',
  'loop.play',
  'loop.stop',
  'loop.stopPlay',
  'loop.undo',
  'loop.clear',
] as const;
export const KNOB_ACTIONS = [
  'mix.master',
  'mix.kick',
  'mix.snare',
  'mix.hihat',
  'mix.toms',
  'mix.cymbals',
  'mix.perc',
  'velocity.sensitivity',
  'velocity.hardest',
  'fx.room',
  'fx.hall',
  'fx.plate',
  'fx.echo',
] as const;
export const ENCODER_ACTIONS = ['kitList.scroll'] as const;

export type ButtonAction = (typeof BUTTON_ACTIONS)[number];
export type KnobAction = (typeof KNOB_ACTIONS)[number];
export type EncoderAction = (typeof ENCODER_ACTIONS)[number];
export type ControlAction = ButtonAction | KnobAction | EncoderAction;
export type ControlKind = 'button' | 'knob' | 'encoder';

const ACTIONS = [...BUTTON_ACTIONS, ...KNOB_ACTIONS, ...ENCODER_ACTIONS] as const;

export const ControlSourceSchema = z.object({
  kind: z.enum(['cc', 'note']),
  channel: z.number().int().min(1).max(16),
  number: z.number().int().min(0).max(127),
});
export type ControlSource = z.infer<typeof ControlSourceSchema>;

export const ENCODER_MODES = ['relative', 'offset', 'absolute'] as const;
export type EncoderMode = (typeof ENCODER_MODES)[number];

export const ControlsConfigSchema = z.object({
  bindings: z.array(z.object({ action: z.enum(ACTIONS), source: ControlSourceSchema })),
  /** Program change n selects the n-th kit in the list (program 0 = first kit). */
  programChangeSelectsKit: z.boolean(),
  encoderMode: z.enum(ENCODER_MODES),
});
export type ControlsConfig = z.infer<typeof ControlsConfigSchema>;
export type ControlBinding = ControlsConfig['bindings'][number];

export const DEFAULT_CONTROLS: ControlsConfig = {
  bindings: [],
  programChangeSelectsKit: true,
  encoderMode: 'relative',
};

export function actionKind(action: ControlAction): ControlKind {
  if ((BUTTON_ACTIONS as readonly string[]).includes(action)) return 'button';
  if ((KNOB_ACTIONS as readonly string[]).includes(action)) return 'knob';
  return 'encoder';
}

export function sourceOf(m: MidiMessage): ControlSource | null {
  if (m.type === 'cc') return { kind: 'cc', channel: m.channel, number: m.controller };
  if (m.type === 'noteon' || m.type === 'noteoff')
    return { kind: 'note', channel: m.channel, number: m.note };
  return null;
}

/** Numeric lookup key (no string allocation on the MIDI path). */
export function sourceKey(s: ControlSource): number {
  return (s.kind === 'note' ? 1 << 16 : 0) | (s.channel << 8) | s.number;
}

export function messageKey(m: MidiMessage): number | null {
  if (m.type === 'cc') return (m.channel << 8) | m.controller;
  if (m.type === 'noteon' || m.type === 'noteoff') return (1 << 16) | (m.channel << 8) | m.note;
  return null;
}

/** Buttons fire on press: a note-on, or a CC with a value above 0 (momentary buttons send 0 on release). */
export function isPress(m: MidiMessage): boolean {
  return m.type === 'noteon' || (m.type === 'cc' && m.value > 0);
}

/** Whether a message can be learned for a control of this kind. */
export function matchesKind(kind: ControlKind, m: MidiMessage): boolean {
  return kind === 'button' ? isPress(m) : m.type === 'cc';
}

/** Assign `source` to `action` (or clear it with null). A source drives one action at a time. */
export function withBinding(
  bindings: readonly ControlBinding[],
  action: ControlAction,
  source: ControlSource | null,
): ControlBinding[] {
  const key = source ? sourceKey(source) : null;
  const rest = bindings.filter((b) => b.action !== action && sourceKey(b.source) !== key);
  return source ? [...rest, { action, source }] : rest;
}

/**
 * Steps from an encoder message. `relative`: two's complement (1 = +1, 127 = −1);
 * `offset`: 64 is no movement (65 = +1, 63 = −1); `absolute`: difference from the last value.
 */
export function encoderDelta(value: number, mode: EncoderMode, last?: number): number {
  if (mode === 'relative') return value < 64 ? value : value - 128;
  if (mode === 'offset') return value - 64;
  return last === undefined ? 0 : value - last;
}

export function knobToRange(value: number, min: number, max: number): number {
  return Math.round(min + ((max - min) * value) / 127);
}

const DB_MIN = -60;
const DB_MAX = 6;

/** Fader law for volume knobs: quadratic in dB, 0 dB at ~70 % travel, bottom is −∞ (−60). 0.5 dB steps. */
export function knobToDb(value: number): number {
  const f = 1 - value / 127;
  const db = DB_MAX - (DB_MAX - DB_MIN) * f * f;
  return Math.round(db * 2) / 2 + 0; // + 0 turns −0 into 0
}
