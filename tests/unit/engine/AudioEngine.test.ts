import { describe, expect, test } from 'vitest';
import { AudioEngine, GAIN_SMOOTHING, MAX_VOICES } from '@/engine/AudioEngine';
import {
  FakeAudioContext,
  FakeBuffer,
  FakeCompressor,
  FakeGain,
  FakeSource,
} from '../fakes/FakeAudioContext';
import { loadedTestKit } from '../fakes/kits';

function setup() {
  const ctx = new FakeAudioContext();
  let clock = 1000;
  const engine = new AudioEngine(
    ctx,
    () => clock,
    () => 0.3,
  );
  engine.setKit(loadedTestKit());
  return { ctx, engine, tick: (ms: number) => (clock += ms) };
}

const lastSource = (ctx: FakeAudioContext) => ctx.sources.at(-1) as FakeSource;

describe('AudioEngine', () => {
  test('builds voice → group → master → limiter → destination graph', () => {
    const { ctx, engine } = setup();
    expect((engine.limiter as FakeCompressor).outputs).toEqual([ctx.destination]);
    expect((engine.master as FakeGain).outputs).toEqual([engine.limiter]);
    expect((engine.groups.kick as FakeGain).outputs).toEqual([engine.master]);
    expect(engine.limiter.threshold.value).toBe(-3);
    expect(engine.limiter.ratio.value).toBe(20);
  });

  test('P1: AudioEngine.trigger starts a source at currentTime with gain = velocity gain × articulation gain', () => {
    const { ctx, engine } = setup();
    ctx.advance(2.5);
    const voice = engine.trigger('snare.center', 127);
    expect(voice).not.toBeNull();
    const src = lastSource(ctx);
    expect(src.startedAt).toBe(2.5);
    // snare.center has gainDb -6 → 0.501 × velocity gain 1.0
    expect((voice!.gain as FakeGain).gain.value).toBeCloseTo(0.501, 3);
    expect(src.outputs).toEqual([voice!.gain]);
    expect((voice!.gain as FakeGain).outputs).toEqual([engine.groups.snare]);

    engine.trigger('kick', 64);
    expect((ctx.sources.at(-1)!.buffer as FakeBuffer).tag).toBe('kick_v2.wav');
    expect((ctx.gains.at(-1) as FakeGain).gain.value).toBeCloseTo(64 / 127);
    engine.trigger('kick', 63);
    expect((ctx.sources.at(-1)!.buffer as FakeBuffer).tag).toBe('kick_v1.wav');
  });

  test('round robin alternates samples within a layer', () => {
    const { ctx, engine } = setup();
    const tags = Array.from({ length: 6 }, () => {
      engine.trigger('snare.center', 100);
      return (ctx.sources.at(-1)!.buffer as FakeBuffer).tag;
    });
    for (let i = 1; i < tags.length; i++) expect(tags[i]).not.toBe(tags[i - 1]);
  });

  test('returns null for unknown, unavailable, zero velocity, or no kit', () => {
    const { engine } = setup();
    expect(engine.trigger('cowbell', 100)).toBeNull();
    expect(engine.trigger('kick', 0)).toBeNull();
    const kit = loadedTestKit();
    engine.setKit({ ...kit, unavailable: new Set(['kick']) });
    expect(engine.isAvailable('kick')).toBe(false);
    expect(engine.trigger('kick', 100)).toBeNull();
    engine.setKit(null);
    expect(engine.trigger('snare.center', 100)).toBeNull();
    expect(engine.stats().ready).toBe(false);
  });

  test('P1: AudioEngine steals the oldest voice in group when 64 voices are active', () => {
    const { ctx, engine } = setup();
    engine.trigger('kick', 100); // oldest overall, different group
    const firstSnare = engine.trigger('snare.center', 100)!;
    for (let i = 0; i < MAX_VOICES - 2; i++) engine.trigger('hihat.closed', 100);
    expect(engine.activeVoices).toHaveLength(MAX_VOICES);

    ctx.advance(1);
    engine.trigger('snare.center', 100);
    expect(engine.activeVoices).toHaveLength(MAX_VOICES);
    expect(engine.activeVoices).not.toContain(firstSnare);
    expect((firstSnare.source as FakeSource).stoppedAt).toBeCloseTo(1.01);
    const fade = (firstSnare.gain as FakeGain).gain.calls.find((c) => c.kind === 'setTargetAtTime');
    expect(fade).toMatchObject({ target: 0, time: 1 });
    expect(engine.stats().steals).toBe(1);

    // No voice in the new voice's group → oldest overall is stolen.
    engine.setKit(loadedTestKit());
    const kickVoice = engine.activeVoices.find((v) => v.group === 'kick')!;
    engine.trigger('hihat.open', 100);
    expect(engine.activeVoices).toHaveLength(MAX_VOICES);
    expect(engine.activeVoices).toContain(kickVoice); // a hihat was stolen instead
  });

  test('R2: 64-voice cap with stealing', () => {
    const { engine } = setup();
    for (let i = 0; i < 200; i++) engine.trigger(i % 2 ? 'kick' : 'hihat.closed', 100);
    expect(engine.activeVoices.length).toBe(MAX_VOICES);
    expect(engine.stats().steals).toBe(200 - MAX_VOICES);
    expect(engine.stats().triggers).toBe(200);
  });

  test('ended voices are released and disconnected', () => {
    const { ctx, engine } = setup();
    const v = engine.trigger('kick', 100)!;
    (v.source as FakeSource).end();
    expect(engine.activeVoices).toHaveLength(0);
    expect((v.gain as FakeGain).disconnected).toBe(true);
    (v.source as FakeSource).end(); // idempotent
    expect(ctx.sources).toHaveLength(1);
  });

  test('P1: AudioEngine.setMasterGainDb(-6) sets master gain to 0.501', () => {
    const { ctx, engine } = setup();
    ctx.advance(3);
    engine.setMasterGainDb(-6);
    const call = (engine.master as FakeGain).gain.calls.at(-1);
    expect(call).toMatchObject({ kind: 'setTargetAtTime', time: 3, timeConstant: GAIN_SMOOTHING });
    expect((engine.master as FakeGain).gain.target).toBeCloseTo(0.501, 3);
    engine.setGroupGainDb('toms', -Infinity);
    expect((engine.groups.toms as FakeGain).gain.target).toBe(0);
  });

  test('records event-to-schedule latency and notifies listeners', () => {
    const { engine, tick } = setup();
    const seen: string[] = [];
    const off = engine.onTrigger((t) => seen.push(t.articulationId));
    for (let i = 0; i < 300; i++) {
      const eventTime = 1000 + i;
      tick(1);
      engine.trigger('kick', 100, eventTime);
    }
    const s = engine.stats();
    expect(s.latency.samples).toBe(256);
    expect(s.latency.median).toBe(s.latency.p95);
    expect(s.lastTrigger).toMatchObject({ articulationId: 'kick', velocity: 100 });
    expect(seen).toHaveLength(300);
    off();
    engine.trigger('kick', 100);
    expect(seen).toHaveLength(300);
  });

  test('setKit keeps old voices ringing', () => {
    const { engine } = setup();
    const v = engine.trigger('kick', 100)!;
    engine.setKit(loadedTestKit());
    expect(engine.activeVoices).toContain(v);
    expect(engine.currentKit?.manifest.id).toBe('test-kit');
    expect(engine.stats().kitId).toBe('test-kit');
  });
});
