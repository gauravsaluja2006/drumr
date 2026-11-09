import type { IAudioContext, IAudioNode, IDelayNode, IGainNode } from './audioContext';
import type { Group } from '@/kits/schema';
import { REVERB_SHAPES, fillImpulse, impulseLength, type ReverbId } from './impulse';

export const EFFECTS = ['room', 'hall', 'plate', 'echo'] as const;
export type EffectId = (typeof EFFECTS)[number];

export interface EffectSetting {
  on: boolean;
  /** 0–1. */
  amount: number;
}
export type FxSettings = Record<EffectId, EffectSetting>;

export const DEFAULT_FX: FxSettings = {
  room: { on: false, amount: 0.4 },
  hall: { on: false, amount: 0.3 },
  plate: { on: false, amount: 0.3 },
  echo: { on: false, amount: 0.25 },
};

/** Send level at amount 1. Reverb IRs are power-normalised by the ConvolverNode. */
export const MAX_SEND: Readonly<Record<EffectId, number>> = { room: 0.9, hall: 0.75, plate: 0.7, echo: 0.6 };

/** How much of each group reaches the effects: little kick (keeps the low end tight), full snare and toms. */
export const GROUP_SEND: Readonly<Record<Group, number>> = {
  kick: 0.3,
  snare: 1,
  hihat: 0.6,
  toms: 1,
  cymbals: 0.7,
  perc: 0.8,
};

/** Low cut before every effect so reverb and echo do not muddy the kick and floor tom. */
export const SEND_HIGHPASS_HZ = 220;
export const ECHO_FEEDBACK = 0.38;
export const ECHO_LOWPASS_HZ = 3500;
/** Echo time: a dotted eighth at the tempo. */
export const echoSeconds = (bpm: number) => Math.min(1.9, (0.75 * 60) / bpm);
const SMOOTHING = 0.02;

export function sendLevel(id: EffectId, s: EffectSetting): number {
  return s.on ? MAX_SEND[id] * s.amount * s.amount : 0;
}

/**
 * Send effects: each group feeds a shared low-cut bus, which feeds every effect through its own
 * send level; effect outputs return into `output` (the master bus). Nodes are created the first
 * time an effect is switched on, so a session without effects pays nothing. The send level sits
 * before each effect, so switching off (or changing kit) lets the tail ring out naturally. Not on
 * the trigger path: voices connect to their group gain as before.
 */
export class Effects {
  private bus: IAudioNode | null = null;
  private sends = new Map<EffectId, IGainNode>();
  private echoDelay: IDelayNode | null = null;
  private bpm = 120;
  private current: FxSettings = DEFAULT_FX;

  constructor(
    private readonly ctx: IAudioContext,
    private readonly groups: Readonly<Record<Group, IAudioNode>>,
    private readonly output: IAudioNode,
    private readonly random: () => number = Math.random,
  ) {}

  get settings(): FxSettings {
    return this.current;
  }

  /** Effects whose nodes exist (switched on at least once). */
  get created(): readonly EffectId[] {
    return [...this.sends.keys()];
  }

  set(settings: FxSettings): void {
    this.current = settings;
    const t = this.ctx.currentTime;
    for (const id of EFFECTS) {
      const level = sendLevel(id, settings[id]);
      const send = this.sends.get(id) ?? (level > 0 ? this.create(id) : null);
      send?.gain.setTargetAtTime(level, t, SMOOTHING);
    }
  }

  setTempo(bpm: number): void {
    this.bpm = bpm;
    this.echoDelay?.delayTime.setTargetAtTime(echoSeconds(bpm), this.ctx.currentTime, 0.05);
  }

  private input(): IAudioNode {
    if (this.bus) return this.bus;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = SEND_HIGHPASS_HZ;
    hp.Q.value = 0.7;
    for (const g of Object.keys(this.groups) as Group[]) {
      const tap = this.ctx.createGain();
      tap.gain.value = GROUP_SEND[g];
      this.groups[g].connect(tap);
      tap.connect(hp);
    }
    this.bus = hp;
    return hp;
  }

  private create(id: EffectId): IGainNode {
    const send = this.ctx.createGain();
    send.gain.value = 0;
    this.input().connect(send);
    if (id === 'echo') {
      const delay = this.ctx.createDelay(2);
      delay.delayTime.value = echoSeconds(this.bpm);
      const tone = this.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = ECHO_LOWPASS_HZ;
      const feedback = this.ctx.createGain();
      feedback.gain.value = ECHO_FEEDBACK;
      send.connect(delay);
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(this.output);
      this.echoDelay = delay;
    } else {
      const conv = this.ctx.createConvolver();
      conv.buffer = this.impulse(id);
      send.connect(conv);
      conv.connect(this.output);
    }
    this.sends.set(id, send);
    return send;
  }

  private impulse(id: ReverbId) {
    const shape = REVERB_SHAPES[id];
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(2, impulseLength(shape, rate), rate);
    fillImpulse([buffer.getChannelData(0), buffer.getChannelData(1)], rate, shape, this.random);
    return buffer;
  }
}
