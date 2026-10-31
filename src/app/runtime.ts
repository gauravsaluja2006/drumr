import { AudioEngine } from '@/engine/AudioEngine';
import { Sampler } from '@/engine/Sampler';
import { createRealAudioContext, type IAudioContext } from '@/engine/audioContext';
import type { FetchLike } from '@/kits/loader';

/** Process-wide audio objects. Created lazily so tests can inject fakes first. */
export interface Runtime {
  ctx: IAudioContext;
  engine: AudioEngine;
  sampler: Sampler;
  fetch: FetchLike;
  kitsBaseUrl: string;
}

let runtime: Runtime | null = null;

export function defaultKitsBaseUrl(): string {
  return import.meta.env.VITE_KITS_BASE_URL ?? `${import.meta.env.BASE_URL}kits/`;
}

export function createRuntime(
  ctx: IAudioContext,
  fetchImpl: FetchLike,
  kitsBaseUrl = defaultKitsBaseUrl(),
): Runtime {
  return {
    ctx,
    engine: new AudioEngine(ctx),
    sampler: new Sampler(ctx, fetchImpl),
    fetch: fetchImpl,
    kitsBaseUrl,
  };
}

export function getRuntime(): Runtime {
  runtime ??= createRuntime(createRealAudioContext(), (url) => fetch(url));
  return runtime;
}

export function setRuntime(r: Runtime | null): void {
  runtime = r;
}
