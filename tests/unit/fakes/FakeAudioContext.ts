import type {
  AudioBufferLike,
  IAudioContext,
  IAudioNode,
  IAudioParam,
  IBufferSourceNode,
  IDynamicsCompressorNode,
  IGainNode,
} from '@/engine/audioContext';

export type ParamCall =
  | { kind: 'setValueAtTime'; value: number; time: number }
  | { kind: 'setTargetAtTime'; target: number; time: number; timeConstant: number }
  | { kind: 'cancelScheduledValues'; time: number };

export class FakeParam implements IAudioParam {
  calls: ParamCall[] = [];
  constructor(public value = 1) {}
  setValueAtTime(value: number, time: number) {
    this.calls.push({ kind: 'setValueAtTime', value, time });
    this.value = value;
  }
  setTargetAtTime(target: number, time: number, timeConstant: number) {
    this.calls.push({ kind: 'setTargetAtTime', target, time, timeConstant });
  }
  cancelScheduledValues(time: number) {
    this.calls.push({ kind: 'cancelScheduledValues', time });
  }
  /** Last scheduled target, or the current value. */
  get target(): number {
    const t = [...this.calls].reverse().find((c) => c.kind === 'setTargetAtTime');
    return t && t.kind === 'setTargetAtTime' ? t.target : this.value;
  }
}

export class FakeNode implements IAudioNode {
  outputs: IAudioNode[] = [];
  disconnected = false;
  constructor(readonly kind: string) {}
  connect(destination: IAudioNode) {
    this.outputs.push(destination);
    return destination;
  }
  disconnect() {
    this.disconnected = true;
  }
}

export class FakeGain extends FakeNode implements IGainNode {
  readonly gain = new FakeParam(1);
  constructor() {
    super('gain');
  }
}

export class FakeSource extends FakeNode implements IBufferSourceNode {
  buffer: AudioBufferLike | null = null;
  onended: ((this: never, ev: Event) => unknown) | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  constructor() {
    super('source');
  }
  start(when = 0) {
    this.startedAt = when;
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
  /** Simulate the browser firing `ended`. */
  end() {
    (this.onended as ((ev: Event) => unknown) | null)?.(new Event('ended'));
  }
}

export class FakeCompressor extends FakeNode implements IDynamicsCompressorNode {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);
  reduction = 0;
  constructor() {
    super('compressor');
  }
}

export class FakeBuffer implements AudioBufferLike {
  constructor(
    readonly duration: number,
    readonly tag = '',
  ) {}
}

export class FakeAudioContext implements IAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  baseLatency = 0.005;
  outputLatency = 0.01;
  readonly destination = new FakeNode('destination');
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  decoded: ArrayBuffer[] = [];
  /** Byte length → tag lets tests check which buffer a voice got. */
  decodeImpl: (data: ArrayBuffer) => Promise<AudioBufferLike> = async (data) =>
    new FakeBuffer(0.5, String(data.byteLength));

  advance(seconds: number) {
    this.currentTime += seconds;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createDynamicsCompressor() {
    return new FakeCompressor();
  }
  decodeAudioData(data: ArrayBuffer) {
    this.decoded.push(data);
    return this.decodeImpl(data);
  }
  async resume() {
    this.state = 'running';
  }
}
