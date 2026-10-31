import { describe, expect, test } from 'vitest';
import { MidiParser, parse } from '@/midi/parse';

describe('MIDI parse', () => {
  test('P3: parse decodes note on, note off, velocity-0 note on as off, CC, and ignores sysex/clock', () => {
    expect(parse([0x90, 36, 100])).toEqual({ type: 'noteon', channel: 1, note: 36, velocity: 100 });
    expect(parse([0x99, 38, 1])).toEqual({ type: 'noteon', channel: 10, note: 38, velocity: 1 });
    expect(parse([0x80, 36, 64])).toEqual({ type: 'noteoff', channel: 1, note: 36, velocity: 64 });
    expect(parse([0x90, 36, 0])).toEqual({ type: 'noteoff', channel: 1, note: 36, velocity: 0 });
    expect(parse([0xb0, 1, 127])).toEqual({ type: 'cc', channel: 1, controller: 1, value: 127 });
    expect(parse([0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7])).toBeNull(); // sysex
    expect(parse([0xf8])).toBeNull(); // clock
    expect(parse([0xfe])).toBeNull(); // active sensing
    expect(parse([0xe0, 0, 64])).toBeNull(); // pitch bend
    expect(parse([0xc0, 5])).toBeNull(); // program change
    expect(parse([0x90, 36])).toBeNull(); // truncated
    expect(parse([])).toBeNull();
    expect(parse(null)).toBeNull();
  });

  test('running status reuses the last channel status; realtime keeps it, system common clears it', () => {
    const p = new MidiParser();
    expect(p.parse([36, 100])).toBeNull(); // no status yet
    expect(p.parse([0x91, 36, 100])).toMatchObject({ type: 'noteon', channel: 2 });
    expect(p.parse([38, 90])).toEqual({ type: 'noteon', channel: 2, note: 38, velocity: 90 });
    p.parse([0xf8]);
    expect(p.parse([40, 80])).toMatchObject({ note: 40 });
    p.parse([0xf2, 0, 0]);
    expect(p.parse([40, 80])).toBeNull();
  });
});
