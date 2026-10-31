import { getRuntime } from './runtime';
import { flashPad } from '@/ui/PadGrid/padFlash';
import { useMappingStore } from '@/state/useMappingStore';
import { useKitStore } from '@/state/useKitStore';
import { padIndex, type Mapping, type PadMapping } from '@/mapping/schema';
import { resolve } from '@/mapping/resolve';
import type { Voice } from '@/mapping/voices';
import type { MidiMessage } from '@/midi/types';
import { curve } from '@/engine/velocity';

/**
 * The hot path: input → pad → voice → articulation → engine. Everything here is synchronous and
 * reads plain lookup tables; React only hears about hits through the rAF-batched pad flash.
 */
export interface HitInfo {
  padIndex: number;
  voice: Voice;
  articulationId: string | null;
  inVelocity: number;
  velocity: number;
  source: 'midi' | 'ui';
}

let byIndex: (PadMapping | undefined)[] = [];
let byNote = new Map<number, number>();
let lastHit: HitInfo | null = null;
const hitListeners = new Set<(hit: HitInfo) => void>();

function index(mapping: Mapping) {
  byIndex = [];
  byNote = new Map();
  for (const pad of mapping.pads) {
    const i = padIndex(mapping, pad);
    byIndex[i] = pad;
    byNote.set(pad.note, i);
  }
}
index(useMappingStore.getState().mapping);
useMappingStore.subscribe((s, prev) => {
  if (s.mapping !== prev.mapping) index(s.mapping);
});

export function resolvePadVoice(voice: Voice): string | null {
  const kit = useKitStore.getState();
  return resolve(voice, { available: kit.available, hihatOpenness: kit.manifest?.hihat?.openness });
}

export function padForNote(note: number): number | undefined {
  return byNote.get(note);
}

function play(i: number, inVelocity: number, velocity: number, eventTime: number, source: HitInfo['source']) {
  const pad = byIndex[i];
  if (!pad) return;
  const articulationId = resolvePadVoice(pad.voice);
  if (articulationId) getRuntime().engine.trigger(articulationId, velocity, eventTime);
  flashPad(i, velocity);
  lastHit = { padIndex: i, voice: pad.voice, articulationId, inVelocity, velocity, source };
  for (const l of hitListeners) l(lastHit);
}

/** On-screen pads and the computer keyboard: velocity is used as-is (no curve). */
export function hitPad(i: number, velocity: number, eventTime: number = performance.now()): void {
  play(i, velocity, velocity, eventTime, 'ui');
}

export function handleMidi(message: MidiMessage, eventTime: number): void {
  if (message.type !== 'noteon') return; // drums are one-shots; CC handling arrives in Phase 4
  const { mapping } = useMappingStore.getState();
  if (mapping.channel !== null && message.channel !== mapping.channel) return;
  const i = byNote.get(message.note);
  if (i === undefined) return;
  play(i, message.velocity, curve(message.velocity, mapping.velocity), eventTime, 'midi');
}

export function getLastHit(): HitInfo | null {
  return lastHit;
}

export function onHit(listener: (hit: HitInfo) => void): () => void {
  hitListeners.add(listener);
  return () => hitListeners.delete(listener);
}
