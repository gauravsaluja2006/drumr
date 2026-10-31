import type { Page } from '@playwright/test';

export type FakeMidiMode = 'ok' | 'deny' | 'unsupported';

export interface FakeMidiApi {
  addInput(d: { id: string; name: string }): void;
  removeInput(id: string): void;
  send(id: string, bytes: number[]): void;
  noteOn(id: string, note: number, velocity: number): void;
  cc(id: string, controller: number, value: number): void;
}

declare global {
  interface Window {
    __fakeMidi?: FakeMidiApi;
  }
}

/**
 * Replaces navigator.requestMIDIAccess before the app loads (docs/05-TESTING.md §3.2).
 * `devices` are present at startup; more can be hot-plugged with window.__fakeMidi.addInput.
 */
export async function installFakeMidi(
  page: Page,
  opts: { mode?: FakeMidiMode; devices?: { id: string; name: string }[] } = {},
) {
  await page.addInitScript(
    ({ mode, devices }) => {
      if (mode === 'unsupported') {
        Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', {
          value: undefined,
          configurable: true,
        });
        Object.defineProperty(navigator, 'requestMIDIAccess', { value: undefined, configurable: true });
        return;
      }
      type Port = {
        id: string;
        name: string;
        manufacturer: string;
        type: 'input';
        state: string;
        onmidimessage: ((e: { data: Uint8Array; timeStamp: number }) => void) | null;
      };
      const inputs = new Map<string, Port>();
      let access: {
        inputs: Map<string, Port>;
        outputs: Map<string, unknown>;
        onstatechange: ((e: { port: Port }) => void) | null;
      } | null = null;
      const add = (d: { id: string; name: string }) => {
        const port: Port = {
          id: d.id,
          name: d.name,
          manufacturer: 'Fake',
          type: 'input',
          state: 'connected',
          onmidimessage: null,
        };
        inputs.set(d.id, port);
        access?.onstatechange?.({ port });
      };
      devices.forEach(add);
      const api = {
        addInput: add,
        removeInput(id: string) {
          const port = inputs.get(id);
          if (!port) return;
          inputs.delete(id);
          port.state = 'disconnected';
          access?.onstatechange?.({ port });
        },
        send(id: string, bytes: number[]) {
          inputs.get(id)?.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp: performance.now() });
        },
        noteOn(id: string, note: number, velocity: number) {
          api.send(id, [0x90, note, velocity]);
        },
        cc(id: string, controller: number, value: number) {
          api.send(id, [0xb0, controller, value]);
        },
      };
      (window as unknown as { __fakeMidi: typeof api }).__fakeMidi = api;
      const request = async () => {
        if (mode === 'deny') throw new DOMException('MIDI access denied', 'SecurityError');
        access = { inputs, outputs: new Map<string, unknown>(), onstatechange: null };
        return access;
      };
      Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', { value: request, configurable: true });
    },
    { mode: opts.mode ?? 'ok', devices: opts.devices ?? [] },
  );
}
