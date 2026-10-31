import { MidiParser } from './parse';
import type {
  MidiAccessLike,
  MidiDevice,
  MidiInputLike,
  MidiMessage,
  MidiState,
  RequestMidiAccess,
} from './types';

export const LAST_DEVICE_KEY = 'drumr.v1.midi.lastDevice';

export type MessageHandler = (message: MidiMessage, eventTime: number) => void;
type Listener = (state: MidiState) => void;

/**
 * Owns Web MIDI: permission, device list, hot-plug, selection, and message parsing.
 * `onMessage` runs synchronously inside the browser's MIDI event (the hot path).
 */
export class MidiManager {
  private access: MidiAccessLike | null = null;
  private devices = new Map<string, MidiInputLike>();
  private selected: MidiInputLike | null = null;
  private parser = new MidiParser();
  private listeners = new Set<Listener>();
  private state: MidiState;
  onMessage: MessageHandler = () => {};

  constructor(
    private readonly request: RequestMidiAccess | undefined,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = globalThis.localStorage ?? null,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.state = { status: request ? 'pending' : 'unsupported', inputs: [], selectedId: null, error: null };
  }

  setMessageHandler(handler: MessageHandler): void {
    this.onMessage = handler;
  }

  getState(): MidiState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async init(): Promise<void> {
    if (!this.request) return this.set({ status: 'unsupported' });
    this.set({ status: 'pending', error: null });
    try {
      this.access = await this.request({ sysex: false });
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      const denied = name === 'SecurityError' || name === 'NotAllowedError';
      return this.set({
        status: denied ? 'denied' : 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
    this.access.onstatechange = () => this.refresh();
    this.refresh();
  }

  select(id: string | null): void {
    if (this.selected) this.selected.onmidimessage = null;
    this.selected = id ? (this.devices.get(id) ?? null) : null;
    this.parser = new MidiParser();
    if (this.selected) {
      this.selected.onmidimessage = (event) => {
        const eventTime = this.now();
        const message = this.parser.parse(event.data);
        if (message) this.onMessage(message, eventTime);
      };
      this.storage?.setItem(LAST_DEVICE_KEY, this.selected.id);
    }
    this.set({ selectedId: this.selected?.id ?? null, status: this.selected ? 'connected' : 'no-device' });
  }

  private refresh() {
    const access = this.access;
    if (!access) return;
    this.devices.clear();
    access.inputs.forEach((input) => {
      if (input.state !== 'disconnected') this.devices.set(input.id, input);
    });
    const inputs: MidiDevice[] = [...this.devices.values()].map((d) => ({
      id: d.id,
      name: d.name || 'Unnamed MIDI device',
    }));
    this.set({ inputs });

    if (this.selected && this.devices.get(this.selected.id) === this.selected) return; // still connected
    if (this.selected) this.selected = null;

    const remembered = this.storage?.getItem(LAST_DEVICE_KEY);
    const pick =
      (remembered && this.devices.has(remembered) ? remembered : null) ??
      (inputs.length === 1 ? inputs[0]!.id : null);
    this.select(pick);
  }

  private set(patch: Partial<MidiState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }
}
