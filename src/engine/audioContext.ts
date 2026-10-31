/**
 * The subset of Web Audio the engine uses. Real AudioContext satisfies it structurally;
 * tests pass FakeAudioContext. Never import the global AudioContext elsewhere in src/engine.
 */
export interface IAudioParam {
  value: number;
  setValueAtTime(value: number, startTime: number): unknown;
  setTargetAtTime(target: number, startTime: number, timeConstant: number): unknown;
  cancelScheduledValues(cancelTime: number): unknown;
}

export interface IAudioNode {
  connect(destination: IAudioNode): unknown;
  disconnect(): void;
}

export interface IGainNode extends IAudioNode {
  readonly gain: IAudioParam;
}

export interface AudioBufferLike {
  readonly duration: number;
}

export interface IBufferSourceNode extends IAudioNode {
  buffer: AudioBufferLike | null;
  onended: ((this: never, ev: Event) => unknown) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface IDynamicsCompressorNode extends IAudioNode {
  readonly threshold: IAudioParam;
  readonly knee: IAudioParam;
  readonly ratio: IAudioParam;
  readonly attack: IAudioParam;
  readonly release: IAudioParam;
  readonly reduction: number;
}

export interface IAudioContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: AudioContextState;
  readonly baseLatency?: number;
  readonly outputLatency?: number;
  readonly destination: IAudioNode;
  createGain(): IGainNode;
  createBufferSource(): IBufferSourceNode;
  createDynamicsCompressor(): IDynamicsCompressorNode;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>;
  resume(): Promise<void>;
}

export function createRealAudioContext(): IAudioContext {
  const Ctor =
    globalThis.AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error('Web Audio is not supported in this browser');
  const ctx: IAudioContext = new Ctor({ latencyHint: 'interactive' });
  return ctx;
}
