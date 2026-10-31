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

/** NI and similar drivers register placeholder ports ("… Virtual Input") for every model they support. */
export const isLikelyVirtual = (name: string) => /\bvirtual\b/i.test(name);

/**
 * Owns Web MIDI: permission, device list, hot-plug, selection, and message parsing.
 * `onMessage` runs synchronously inside the browser's MIDI event (the hot path).
 *
 * Selection order: the remembered device, else the only device, else listen on all devices and
 * connect to the first one that sends a note-on (that note still plays).
 */
export class MidiManager {
  private access: MidiAccessLike | null = null;
  private devices = new Map<string, MidiInputLike>();
  private selected: MidiInputLike | null = null;
  private parser = new MidiParser();
  private listeners = new Set<Listener>();
  private state: MidiState;
  /** Set when the user explicitly disconnects; cleared when the device list changes. */
  private userChoseNone = false;
  onMessage: MessageHandler = () => {};

  constructor(
    private readonly request: RequestMidiAccess | undefined,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = globalThis.localStorage ?? null,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.state = {
      status: request ? 'pending' : 'unsupported',
      inputs: [],
      selectedId: null,
      error: null,
      listening: false,
    };
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
    this.userChoseNone = false;
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

  /** User choice from the device menu. `null` disconnects and turns auto-connect off. */
  select(id: string | null): void {
    if (id === null) this.userChoseNone = true;
    this.connect(id);
  }

  private connect(id: string | null) {
    this.detachAll();
    this.selected = id ? (this.devices.get(id) ?? null) : null;
    this.parser = new MidiParser();
    if (this.selected) {
      this.selected.onmidimessage = (event) => {
        const eventTime = this.now();
        const message = this.parser.parse(event.data);
        if (message) this.onMessage(message, eventTime);
      };
      this.storage?.setItem(LAST_DEVICE_KEY, this.selected.id);
      return this.set({ selectedId: this.selected.id, status: 'connected', listening: false });
    }
    const listening = !this.userChoseNone && this.devices.size > 0;
    if (listening) this.listenAll();
    this.set({ selectedId: null, status: 'no-device', listening });
  }

  /** Attach to every input; the first note-on picks that device and is delivered as normal. */
  private listenAll() {
    for (const input of this.devices.values()) {
      const parser = new MidiParser();
      input.onmidimessage = (event) => {
        const eventTime = this.now();
        const message = parser.parse(event.data);
        if (message?.type !== 'noteon') return;
        this.connect(input.id);
        this.onMessage(message, eventTime);
      };
    }
  }

  private detachAll() {
    for (const input of this.devices.values()) input.onmidimessage = null;
  }

  private refresh() {
    const access = this.access;
    if (!access) return;
    const before = [...this.devices.keys()].sort().join('\n');
    this.detachAll();
    this.devices.clear();
    access.inputs.forEach((input) => {
      if (input.state !== 'disconnected') this.devices.set(input.id, input);
    });
    if ([...this.devices.keys()].sort().join('\n') !== before) this.userChoseNone = false;
    // Real-looking devices first, driver placeholders ("Virtual") last; otherwise keep the OS order.
    const inputs: MidiDevice[] = [...this.devices.values()]
      .map((d) => ({ id: d.id, name: d.name || 'Unnamed MIDI device' }))
      .sort((a, b) => Number(isLikelyVirtual(a.name)) - Number(isLikelyVirtual(b.name)));
    this.set({ inputs });

    const stillThere =
      this.selected && this.devices.get(this.selected.id) === this.selected ? this.selected.id : null;
    const remembered = this.storage?.getItem(LAST_DEVICE_KEY);
    const pick =
      stillThere ??
      (remembered && this.devices.has(remembered) ? remembered : null) ??
      (inputs.length === 1 ? inputs[0]!.id : null);
    this.connect(this.userChoseNone && !stillThere ? null : pick);
  }

  private set(patch: Partial<MidiState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }
}
