import { describe, expect, test } from 'vitest';
import { Looper, MAX_LOOP_MS, TAIL_MS, type LoopInput } from '@/engine/Looper';

const hit = (pad: number, velocity = 100): LoopInput => ({ kind: 'hit', pad, voice: 'kick', velocity });
const times = (l: Looper) => l.events.map((e) => e.t);

describe('Looper', () => {
  test('arming does not record; the first hit is frame 0 and captures the hi-hat position', () => {
    const l = new Looper();
    l.arm();
    expect(l.phase).toBe('armed');
    expect(l.input({ kind: 'cc', value: 90 }, 500)).toBe(false); // pedal moves alone do not start it
    expect(l.phase).toBe('armed');
    expect(l.input(hit(13), 1_000, 64)).toBe(true);
    expect(l.phase).toBe('recording');
    expect(l.start).toBe(1_000);
    expect(l.events).toEqual([
      { t: 0, layer: 0, kind: 'cc', value: 64 },
      { t: 0, layer: 0, kind: 'hit', pad: 13, voice: 'kick', velocity: 100 },
    ]);
    l.input(hit(14), 1_250);
    expect(times(l)).toEqual([0, 0, 250]);
  });

  test('free length: the loop ends at the press, hits in the last 40 ms belong to the next pass', () => {
    const l = new Looper();
    l.arm();
    l.input(hit(13), 1_000);
    l.input(hit(14), 1_500);
    l.input(hit(13), 3_000 - TAIL_MS + 5); // the player hit the "1" again just before pressing
    expect(l.close(3_000)).toBe(true);
    expect(l.phase).toBe('playing');
    expect(l.length).toBe(2_000);
    expect(times(l)).toEqual([0, 500]);
    expect(l.position(3_000)).toBe(0); // frame 0 again right at the press: no gap
    expect(l.position(3_700)).toBe(700);
  });

  test('whole bars: the length rounds to the nearest bar and the phase stays on the first hit', () => {
    const bar = 2_000; // 120 BPM
    const late = new Looper();
    late.arm();
    late.input(hit(13), 1_000);
    late.input(hit(14), 2_000);
    late.input(hit(13), 5_050); // next pass's downbeat, played before the (late) press
    late.close(5_300, { barMs: bar });
    expect(late.length).toBe(4_000);
    expect(times(late)).toEqual([0, 1_000]); // hits past the end are dropped
    expect(late.position(5_300)).toBe(300); // already 300 ms into pass 2

    const early = new Looper();
    early.arm();
    early.input(hit(13), 1_000);
    early.close(2_700, { barMs: bar }); // 0.85 bar rounds up to 1
    expect(early.length).toBe(2_000);
    expect(early.position(2_700)).toBe(1_700);

    const tiny = new Looper();
    tiny.arm();
    tiny.input(hit(13), 1_000);
    tiny.close(1_200, { barMs: bar }); // never shorter than one bar
    expect(tiny.length).toBe(2_000);
  });

  test('a loop shorter than 250 ms is discarded; closing while armed cancels', () => {
    const l = new Looper();
    l.arm();
    l.input(hit(13), 1_000);
    expect(l.close(1_100)).toBe(false);
    expect(l.phase).toBe('idle');
    l.arm();
    expect(l.close(2_000)).toBe(false);
    expect(l.phase).toBe('idle');
  });

  test('recording reports when it reaches the 2-minute limit', () => {
    const l = new Looper();
    l.arm();
    l.input(hit(13), 0);
    expect(l.isFull(MAX_LOOP_MS - 1)).toBe(false);
    expect(l.isFull(MAX_LOOP_MS)).toBe(true);
  });

  test('due lists events with absolute times across loop boundaries, each boundary first', () => {
    const l = new Looper();
    l.arm();
    l.input(hit(13), 1_000);
    l.input(hit(14), 1_500);
    l.close(2_000); // length 1000, passes start at 1000, 2000, 3000…
    const at = (from: number, to: number) =>
      l.due(from, to).map((d) => (d.kind === 'boundary' ? `|${d.at}` : `${d.event.kind}@${d.at}`));
    expect(at(1_999.9, 2_010)).toEqual(['|2000', 'hit@2000']);
    expect(at(2_010, 2_600)).toEqual(['hit@2500']);
    expect(at(2_600, 4_600)).toEqual(['|3000', 'hit@3000', 'hit@3500', '|4000', 'hit@4000', 'hit@4500']);
    l.stop();
    expect(l.due(5_000, 9_000)).toEqual([]);
  });

  test('overdub layers wrap into the loop, sort in, and undo removes the newest layer only', () => {
    const l = new Looper();
    l.arm();
    l.input(hit(13), 0);
    l.close(1_000);
    expect(l.input(hit(1), 1_200)).toBe(false); // playing: live hits are not recorded
    l.toggleOverdub();
    expect(l.phase).toBe('overdub');
    l.input(hit(2), 2_300); // 300 ms into pass 3
    l.input(hit(3), 2_100);
    expect(l.events.map((e) => [e.t, e.layer])).toEqual([
      [0, 0],
      [100, 1],
      [300, 1],
    ]);
    l.toggleOverdub();
    expect(l.layers).toBe(2);
    l.toggleOverdub();
    l.toggleOverdub(); // empty overdub pass is not a layer
    expect(l.layers).toBe(2);
    l.undo();
    expect(l.layers).toBe(1);
    expect(times(l)).toEqual([0]);
    l.undo(); // the first take stays; Clear removes it
    expect(times(l)).toEqual([0]);
  });

  test('stop keeps the loop; play restarts it from frame 0; clear forgets it', () => {
    const l = new Looper();
    l.arm();
    l.input(hit(13), 0);
    l.close(1_000);
    l.stop();
    expect(l.phase).toBe('stopped');
    l.play(5_250);
    expect(l.phase).toBe('playing');
    expect(l.position(5_250)).toBe(0);
    l.clear();
    expect(l.phase).toBe('idle');
    expect(l.events).toEqual([]);
    expect(l.length).toBe(0);
  });
});
