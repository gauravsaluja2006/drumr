import { AudioEngine } from '@/engine/AudioEngine';
import { Sampler } from '@/engine/Sampler';
import { createRealAudioContext, type IAudioContext } from '@/engine/audioContext';
import type { FetchLike } from '@/kits/loader';
import { MidiManager } from '@/midi/MidiManager';
import type { RequestMidiAccess } from '@/midi/types';

/** Process-wide audio objects. Created lazily so tests can inject fakes first. */
export interface Runtime {
  ctx: IAudioContext;
  engine: AudioEngine;
  sampler: Sampler;
  fetch: FetchLike;
  kitsBaseUrl: string;
  midi: MidiManager;
}

let runtime: Runtime | null = null;

export function defaultKitsBaseUrl(): string {
  return import.meta.env.VITE_KITS_BASE_URL ?? `${import.meta.env.BASE_URL}kits/`;
}

/** Web MIDI entry point, or undefined where the browser has none (Safari, jsdom). */
export function browserMidiAccess(): RequestMidiAccess | undefined {
  const nav = globalThis.navigator as (Navigator & { requestMIDIAccess?: unknown }) | undefined;
  if (typeof nav?.requestMIDIAccess !== 'function') return undefined;
  // The real MIDIAccess structurally matches MidiAccessLike apart from DOM `this` typings.
  return (options) => nav.requestMIDIAccess(options) as unknown as ReturnType<RequestMidiAccess>;
}

export function createRuntime(
  ctx: IAudioContext,
  fetchImpl: FetchLike,
  kitsBaseUrl = defaultKitsBaseUrl(),
  midi = new MidiManager(browserMidiAccess()),
): Runtime {
  return {
    ctx,
    engine: new AudioEngine(ctx),
    sampler: new Sampler(ctx, fetchImpl),
    fetch: fetchImpl,
    kitsBaseUrl,
    midi,
  };
}

export function getRuntime(): Runtime {
  runtime ??= createRuntime(createRealAudioContext(), (url) => fetch(url));
  return runtime;
}

export function setRuntime(r: Runtime | null): void {
  runtime = r;
}
