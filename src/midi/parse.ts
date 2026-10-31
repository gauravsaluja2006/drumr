import type { MidiMessage } from './types';

/**
 * Parses one Web MIDI message. Channel is 1-16. Note-on with velocity 0 is a note-off.
 * Running status (data bytes without a status byte) reuses the previous channel-voice status.
 * Everything other than note on/off and control change is ignored (sysex, clock, pitch bend, ...).
 */
export class MidiParser {
  private running = 0;

  parse(data: ArrayLike<number> | null): MidiMessage | null {
    if (!data || data.length === 0) return null;
    let status = data[0] as number;
    let i = 1;
    if (status < 0x80) {
      if (!this.running) return null;
      status = this.running;
      i = 0;
    } else if (status < 0xf0) {
      this.running = status;
    } else {
      if (status < 0xf8) this.running = 0; // system common cancels running status; realtime does not
      return null;
    }
    const kind = status & 0xf0;
    const channel = (status & 0x0f) + 1;
    const d1 = data[i];
    const d2 = data[i + 1];
    if (d1 === undefined || d2 === undefined) return null;
    switch (kind) {
      case 0x90:
        return d2 === 0
          ? { type: 'noteoff', channel, note: d1, velocity: 0 }
          : { type: 'noteon', channel, note: d1, velocity: d2 };
      case 0x80:
        return { type: 'noteoff', channel, note: d1, velocity: d2 };
      case 0xb0:
        return { type: 'cc', channel, controller: d1, value: d2 };
      default:
        return null;
    }
  }
}

export function parse(data: ArrayLike<number> | null): MidiMessage | null {
  return new MidiParser().parse(data);
}
