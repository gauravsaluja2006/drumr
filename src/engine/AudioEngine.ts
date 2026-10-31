import type { IAudioContext, IBufferSourceNode, IDynamicsCompressorNode, IGainNode } from './audioContext';
import type { LoadedKit } from './Sampler';
import { GROUPS, type Group } from '@/kits/schema';
import { gainFor, layerFor, pickRoundRobin } from './velocity';
import { dbToGain, median, percentile } from '@/lib/audioMath';

export const MAX_VOICES = 64;
/** Time constant for gain changes from the mixer (≈10 ms, no zipper noise). */
export const GAIN_SMOOTHING = 0.01;
/** Voice-steal fade: time constant and hard stop offset (≈5 ms). */
const STEAL_TC = 0.0015;
const STEAL_STOP = 0.01;
/** Choke: time constant 12 ms reaches −60 dB in ≈40 ms; hard stop at 80 ms (docs/02 §3.6). */
export const CHOKE_TC = 0.012;
export const CHOKE_STOP = 0.08;
/** Choke voices that silence a cymbal even when the kit has no sample for them. */
export const IMPLICIT_CHOKES: Readonly<Record<string, string>> = {
  'crash.leftChoke': 'crash.left',
  'crash.rightChoke': 'crash.right',
};
const LATENCY_SAMPLES = 256;

export interface Voice {
  id: number;
  articulationId: string;
  group: Group;
  /** Articulations whose start silences this voice (from the manifest at trigger time). */
  chokedBy: readonly string[];
  source: IBufferSourceNode;
  gain: IGainNode;
  startedAt: number;
}

export interface TriggerInfo {
  articulationId: string;
  velocity: number;
  atTime: number;
}

export interface EngineStats {
  ready: boolean;
  kitId: string | null;
  activeVoices: number;
  triggers: number;
  steals: number;
  chokes: number;
  lastTrigger: TriggerInfo | null;
  latency: { median: number; p95: number; samples: number };
}

export type EngineListener = (info: TriggerInfo) => void;
export type VoiceEndReason = 'ended' | 'choked' | 'stolen';
export type VoiceListener = (voice: Voice, reason: VoiceEndReason) => void;

export class AudioEngine {
  readonly master: IGainNode;
  readonly limiter: IDynamicsCompressorNode;
  readonly groups: Record<Group, IGainNode>;
  /** Last requested gains in dB (AudioParam.value lags behind setTargetAtTime). */
  readonly gainDb: { master: number } & Record<Group, number> = {
    master: 0,
    kick: 0,
    snare: 0,
    hihat: 0,
    toms: 0,
    cymbals: 0,
    perc: 0,
  };

  private kit: LoadedKit | null = null;
  private voices: Voice[] = [];
  private nextVoiceId = 1;
  private lastRoundRobin = new Map<string, number>();
  private latencies: number[] = [];
  private latencyCursor = 0;
  private counters = { triggers: 0, steals: 0, chokes: 0 };
  private last: TriggerInfo | null = null;
  private listeners = new Set<EngineListener>();
  private endListeners = new Set<VoiceListener>();

  constructor(
    readonly ctx: IAudioContext,
    private readonly now: () => number = () => performance.now(),
    private readonly random: () => number = Math.random,
  ) {
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;
    this.limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(this.limiter);

    const groups = {} as Record<Group, IGainNode>;
    for (const g of GROUPS) {
      const node = ctx.createGain();
      node.connect(this.master);
      groups[g] = node;
    }
    this.groups = groups;
  }

  setKit(kit: LoadedKit | null): void {
    // Voices from the previous kit keep ringing; they hold their own buffers.
    this.kit = kit;
    this.lastRoundRobin.clear();
  }

  get currentKit(): LoadedKit | null {
    return this.kit;
  }

  isAvailable(articulationId: string): boolean {
    return !!this.kit?.articulations.has(articulationId) && !this.kit.unavailable.has(articulationId);
  }

  /**
   * Play an articulation now. Synchronous by design: this is the MIDI hot path.
   * @param eventTime performance.now() when the input event arrived, for latency stats.
   */
  trigger(articulationId: string, velocity: number, eventTime?: number): Voice | null {
    const kit = this.kit;
    const art = kit?.articulations.get(articulationId);
    if (!kit || !art || kit.unavailable.has(articulationId) || velocity <= 0) return null;

    const layer = layerFor(velocity, art.layers);
    const rrKey = `${art.id}@${layer.lovel}`;
    const index = pickRoundRobin(layer.samples.length, this.lastRoundRobin.get(rrKey), this.random);
    this.lastRoundRobin.set(rrKey, index);
    const buffer = kit.buffers.get(layer.samples[index] as string);
    if (!buffer) return null;

    this.choke(art.id);
    if (this.voices.length >= MAX_VOICES) this.steal(art.group);

    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = gainFor(velocity) * dbToGain(art.gainDb);
    source.connect(gain);
    gain.connect(this.groups[art.group]);

    const voice: Voice = {
      id: this.nextVoiceId++,
      articulationId: art.id,
      group: art.group,
      chokedBy: art.chokedBy ?? [],
      source,
      gain,
      startedAt: t,
    };
    source.onended = () => {
      this.release(voice, 'ended');
      gain.disconnect();
    };
    this.voices.push(voice);

    if (eventTime !== undefined) this.recordLatency(this.now() - eventTime);
    source.start(t);

    this.counters.triggers++;
    this.last = { articulationId: art.id, velocity, atTime: t };
    for (const l of this.listeners) l(this.last);
    return voice;
  }

  /**
   * Silences every sounding voice that `chokerId` chokes: voices listing it in `chokedBy`, plus the
   * implicit cymbal targets in IMPLICIT_CHOKES. Called on every trigger, and directly for choke-only
   * pads whose kit has no choke sample. Returns the number of voices choked.
   */
  choke(chokerId: string): number {
    const implicit = IMPLICIT_CHOKES[chokerId];
    const victims = this.voices.filter((v) => v.chokedBy.includes(chokerId) || v.articulationId === implicit);
    for (const v of victims) this.fadeOut(v, CHOKE_TC, CHOKE_STOP, 'choked');
    this.counters.chokes += victims.length;
    return victims.length;
  }

  onVoiceEnd(listener: VoiceListener): () => void {
    this.endListeners.add(listener);
    return () => this.endListeners.delete(listener);
  }

  onTrigger(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setMasterGainDb(db: number): void {
    this.gainDb.master = db;
    this.master.gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, GAIN_SMOOTHING);
  }

  setGroupGainDb(group: Group, db: number): void {
    this.gainDb[group] = db;
    this.groups[group].gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, GAIN_SMOOTHING);
  }

  get activeVoices(): readonly Voice[] {
    return this.voices;
  }

  stats(): EngineStats {
    return {
      ready: this.kit !== null,
      kitId: this.kit?.manifest.id ?? null,
      activeVoices: this.voices.length,
      ...this.counters,
      lastTrigger: this.last,
      latency: {
        median: median(this.latencies),
        p95: percentile(this.latencies, 95),
        samples: this.latencies.length,
      },
    };
  }

  /** Fade and stop a voice early (stealing and choking). */
  protected fadeOut(voice: Voice, timeConstant: number, stopAfter: number, reason: VoiceEndReason): void {
    const t = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setTargetAtTime(0, t, timeConstant);
    voice.source.stop(t + stopAfter);
    this.release(voice, reason);
  }

  private steal(group: Group) {
    const victim = this.voices.find((v) => v.group === group) ?? this.voices[0];
    if (!victim) return;
    this.counters.steals++;
    this.fadeOut(victim, STEAL_TC, STEAL_STOP, 'stolen');
  }

  private release(voice: Voice, reason: VoiceEndReason) {
    const i = this.voices.indexOf(voice);
    if (i === -1) return;
    this.voices.splice(i, 1);
    for (const l of this.endListeners) l(voice, reason);
  }

  private recordLatency(ms: number) {
    if (this.latencies.length < LATENCY_SAMPLES) this.latencies.push(ms);
    else this.latencies[this.latencyCursor] = ms;
    this.latencyCursor = (this.latencyCursor + 1) % LATENCY_SAMPLES;
  }
}
