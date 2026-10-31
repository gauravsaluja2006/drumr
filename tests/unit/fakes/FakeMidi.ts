import type { MidiAccessLike, MidiInputLike } from '@/midi/types';

export class FakeInput implements MidiInputLike {
  state = 'connected';
  onmidimessage: ((event: { data: Uint8Array | null }) => void) | null = null;
  constructor(
    readonly id: string,
    readonly name: string | null,
  ) {}
  send(bytes: number[]) {
    this.onmidimessage?.({ data: new Uint8Array(bytes) });
  }
}

export class FakeMidiAccess implements MidiAccessLike {
  readonly map = new Map<string, FakeInput>();
  onstatechange: MidiAccessLike['onstatechange'] = null;
  readonly inputs = { forEach: (cb: (i: MidiInputLike) => void) => this.map.forEach(cb) };

  add(id: string, name: string | null = id) {
    const input = new FakeInput(id, name);
    this.map.set(id, input);
    this.onstatechange?.({ port: { id, type: 'input', state: 'connected' } });
    return input;
  }
  remove(id: string) {
    const input = this.map.get(id);
    if (!input) return;
    input.state = 'disconnected';
    this.map.delete(id);
    this.onstatechange?.({ port: { id, type: 'input', state: 'disconnected' } });
  }
}

export function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
