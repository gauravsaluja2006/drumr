import { describe, expect, test } from 'vitest';
import { AudioEngine } from '@/engine/AudioEngine';
import {
  DEFAULT_FX,
  ECHO_FEEDBACK,
  GROUP_SEND,
  MAX_SEND,
  echoSeconds,
  type FxSettings,
} from '@/engine/Effects';
import { FakeAudioContext, FakeAudioBuffer, type FakeGain } from '../fakes/FakeAudioContext';

const with_ = (patch: Partial<FxSettings>): FxSettings => ({ ...DEFAULT_FX, ...patch });

describe('effects', () => {
  test('nothing is created until an effect is switched on', () => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine(ctx);
    const gains = ctx.gains.length;
    engine.effects.set(DEFAULT_FX);
    expect(ctx.gains.length).toBe(gains);
    expect(ctx.convolvers).toEqual([]);
    expect(engine.effects.created).toEqual([]);
  });

  test('room: groups feed a low-cut bus through their send weights, into a convolver that returns to master', () => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine(ctx);
    engine.effects.set(with_({ room: { on: true, amount: 0.5 } }));
    const [conv] = ctx.convolvers;
    expect(conv?.buffer).toBeInstanceOf(FakeAudioBuffer);
    expect(conv?.buffer?.numberOfChannels).toBe(2);
    expect(conv?.outputs).toEqual([engine.master]);
    const hp = ctx.filters.find((f) => f.type === 'highpass')!;
    const kickTap = (engine.groups.kick as FakeGain).outputs.find((n) => n !== engine.master) as FakeGain;
    expect(kickTap.gain.value).toBe(GROUP_SEND.kick);
    expect(kickTap.outputs).toEqual([hp]);
    const send = hp.outputs[0] as FakeGain;
    expect(send.outputs).toEqual([conv]);
    expect(send.gain.target).toBeCloseTo(MAX_SEND.room * 0.25);
  });

  test('several at once; switching one off ramps its send to zero and keeps its nodes for the tail', () => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine(ctx);
    engine.effects.set(with_({ hall: { on: true, amount: 1 }, echo: { on: true, amount: 1 } }));
    expect(engine.effects.created).toEqual(['hall', 'echo']);
    const hp = ctx.filters.find((f) => f.type === 'highpass')!;
    const [hallSend, echoSend] = hp.outputs as FakeGain[];
    engine.effects.set(with_({ hall: { on: false, amount: 1 }, echo: { on: true, amount: 1 } }));
    expect(hallSend!.gain.target).toBe(0);
    expect(echoSend!.gain.target).toBeCloseTo(MAX_SEND.echo);
    expect(ctx.convolvers).toHaveLength(1); // not rebuilt
    engine.effects.set(with_({ hall: { on: true, amount: 1 } }));
    expect(ctx.convolvers).toHaveLength(1);
  });

  test('echo is a dotted eighth at the tempo with filtered feedback', () => {
    const ctx = new FakeAudioContext();
    const engine = new AudioEngine(ctx);
    engine.effects.setTempo(100);
    engine.effects.set(with_({ echo: { on: true, amount: 0.5 } }));
    const [delay] = ctx.delays;
    expect(delay?.delayTime.value).toBeCloseTo(0.45);
    expect(ctx.gains.some((g) => g.gain.value === ECHO_FEEDBACK && g.outputs.includes(delay!))).toBe(true);
    engine.effects.setTempo(120);
    expect(delay?.delayTime.target).toBeCloseTo(echoSeconds(120));
  });
});
