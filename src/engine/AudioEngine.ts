import type {
  IAnalyserNode,
  IAudioContext,
  IBufferSourceNode,
  IDynamicsCompressorNode,
  IGainNode,
} from './audioContext';
import type { LoadedKit } from './Sampler';
import { GROUPS, type Group } from '@/kits/schema';
import { HUMANIZE_CENTS, HUMANIZE_DB, gainFor, layerFor, pickRoundRobin } from './velocity';
import { dbToGain, median, percentile } from '@/lib/audioMath';
import { Effects } from './Effects';

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

/** Per-group sound shaping: tune in semitones, length as a fraction of the natural decay (0.1–1). */
export interface GroupTone {
  tune: number;
  decay: number;
}
export const DEFAULT_TONE: GroupTone = { tune: 0, decay: 1 };
export const MIN_DECAY = 0.1;

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
  /** Reverb and echo sends (docs/02-ARCHITECTURE.md ADR-39). */
  readonly effects: Effects;
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
  private analyser: IAnalyserNode | null = null;
  private meterData: Float32Array<ArrayBuffer> | null = null;
  private tones = {} as Record<Group, GroupTone>;
  private humanize = false;
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
    for (const g of GROUPS) this.tones[g] = DEFAULT_TONE;
    this.effects = new Effects(ctx, groups, this.master, random);
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
   * @param at AudioContext time to start at (loop playback schedules slightly ahead); default now.
   */
  trigger(articulationId: string, velocity: number, eventTime?: number, at?: number): Voice | null {
    const kit = this.kit;
    const art = kit?.articulations.get(articulationId);
    if (!kit || !art || kit.unavailable.has(articulationId) || velocity <= 0) return null;

    const layer = layerFor(velocity, art.layers);
    const rrKey = `${art.id}@${layer.lovel}`;
    const index = pickRoundRobin(layer.samples.length, this.lastRoundRobin.get(rrKey), this.random);
    this.lastRoundRobin.set(rrKey, index);
    const buffer = kit.buffers.get(layer.samples[index] as string);
    if (!buffer) return null;

    const t = Math.max(this.ctx.currentTime, at ?? 0);
    this.choke(art.id, t);
    if (this.voices.length >= MAX_VOICES) this.steal(art.group, t);

    const tone = this.tones[art.group];
    let rate = tone.tune ? 2 ** (tone.tune / 12) : 1;
    let vary = 1;
    if (this.humanize) {
      rate *= 2 ** (((this.random() * 2 - 1) * HUMANIZE_CENTS) / 1200);
      vary = dbToGain((this.random() * 2 - 1) * HUMANIZE_DB);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    if (rate !== 1) source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = gainFor(velocity, layer.hivel) * dbToGain(art.gainDb) * vary;
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
    if (tone.decay < 1) {
      // Shorter decay: hold the attack, then fade so the sound is ≈ −40 dB at `length`.
      const length = (buffer.duration / rate) * Math.max(MIN_DECAY, tone.decay);
      gain.gain.setTargetAtTime(0, t + length * 0.25, length * 0.16);
      source.stop(t + length + 0.02);
    }

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
  choke(chokerId: string, at?: number): number {
    const implicit = IMPLICIT_CHOKES[chokerId];
    const victims = this.voices.filter((v) => v.chokedBy.includes(chokerId) || v.articulationId === implicit);
    for (const v of victims) this.fadeOut(v, CHOKE_TC, CHOKE_STOP, 'choked', at);
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

  /** Tune and length for a group; applies to hits from now on (ringing voices keep theirs). */
  setGroupTone(group: Group, tone: GroupTone): void {
    this.tones[group] = {
      tune: Math.min(12, Math.max(-12, tone.tune)),
      decay: Math.min(1, Math.max(MIN_DECAY, tone.decay)),
    };
  }

  groupTone(group: Group): GroupTone {
    return this.tones[group];
  }

  /** Small random level (±1 dB) and pitch (±8 cents) changes per hit. Off by default (tests). */
  setHumanize(on: boolean): void {
    this.humanize = on;
  }

  setGroupGainDb(group: Group, db: number): void {
    this.gainDb[group] = db;
    this.groups[group].gain.setTargetAtTime(dbToGain(db), this.ctx.currentTime, GAIN_SMOOTHING);
  }

  /** Whether anything may still be audible: voices sounding, or a hit within `tailSeconds` (reverb). */
  isActive(tailSeconds = 4): boolean {
    return this.voices.length > 0 || (!!this.last && this.ctx.currentTime - this.last.atTime < tailSeconds);
  }

  /**
   * Peak level of the output (after the limiter) over the last ~20 ms, 0–1. The analyser is
   * created on first call, so it costs nothing until a meter is shown.
   */
  outputPeak(): number {
    if (!this.analyser) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.limiter.connect(this.analyser);
      this.meterData = new Float32Array(this.analyser.fftSize);
    }
    const data = this.meterData!;
    this.analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]!);
      if (v > peak) peak = v;
    }
    return peak;
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
  protected fadeOut(
    voice: Voice,
    timeConstant: number,
    stopAfter: number,
    reason: VoiceEndReason,
    at?: number,
  ): void {
    const t = Math.max(this.ctx.currentTime, at ?? 0);
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setTargetAtTime(0, t, timeConstant);
    try {
      voice.source.stop(t + stopAfter);
    } catch {
      // Older engines reject a second stop() (a shortened decay already scheduled one).
    }
    this.release(voice, reason);
  }

  private steal(group: Group, at?: number) {
    const victim = this.voices.find((v) => v.group === group) ?? this.voices[0];
    if (!victim) return;
    this.counters.steals++;
    this.fadeOut(victim, STEAL_TC, STEAL_STOP, 'stolen', at);
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
