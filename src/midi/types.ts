export type MidiMessage =
  | { type: 'noteon'; channel: number; note: number; velocity: number }
  | { type: 'noteoff'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; controller: number; value: number };

/** Structural subset of Web MIDI used by MidiManager (real MIDIAccess and the test fakes both satisfy it). */
export interface MidiInputLike {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer?: string | null;
  readonly state: string; // 'connected' | 'disconnected'
  onmidimessage: ((event: { data: Uint8Array | null }) => void) | null;
}

export interface MidiAccessLike {
  readonly inputs: { forEach(cb: (input: MidiInputLike) => void): void };
  onstatechange: ((event: { port: { id: string; type?: string; state: string } | null }) => void) | null;
}

export type RequestMidiAccess = (options: { sysex: boolean }) => Promise<MidiAccessLike>;

export type MidiStatus = 'unsupported' | 'pending' | 'denied' | 'error' | 'no-device' | 'connected';

export interface MidiDevice {
  id: string;
  name: string;
}

export interface MidiState {
  status: MidiStatus;
  inputs: MidiDevice[];
  selectedId: string | null;
  error: string | null;
}
