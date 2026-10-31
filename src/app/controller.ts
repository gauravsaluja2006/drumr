import { getRuntime } from './runtime';
import { flashPad, ringPad } from '@/ui/PadGrid/padFlash';
import { useMappingStore } from '@/state/useMappingStore';
import { useKitStore } from '@/state/useKitStore';
import { padIndex, type Mapping, type PadMapping } from '@/mapping/schema';
import { resolve } from '@/mapping/resolve';
import type { Voice } from '@/mapping/voices';
import type { MidiMessage } from '@/midi/types';
import { curve } from '@/engine/velocity';
import { HiHatState } from '@/engine/HiHat';
import type { AudioEngine } from '@/engine/AudioEngine';
import { useUiStore } from '@/state/useUiStore';

/**
 * The hot path: input → pad → voice → articulation → engine. Everything here is synchronous and
 * reads plain lookup tables; React only hears about hits through rAF-batched DOM updates.
 */
export interface HitInfo {
  padIndex: number;
  voice: Voice;
  articulationId: string | null;
  inVelocity: number;
  velocity: number;
  source: 'midi' | 'ui';
}

const CHOKE_ONLY = new Set<Voice>(['crash.leftChoke', 'crash.rightChoke']);
const PEDAL_ON_CLOSE_VELOCITY = 60;

let byIndex: (PadMapping | undefined)[] = [];
let byNote = new Map<number, number>();
let lastHit: HitInfo | null = null;
const hitListeners = new Set<(hit: HitInfo) => void>();
const hihatListeners = new Set<(value: number | null) => void>();
let capture: ((note: number) => void) | null = null;

/**
 * MIDI learn: the next note-on goes to `cb` instead of playing. Returns a cancel function.
 */
export function captureNextNote(cb: (note: number) => void): () => void {
  capture = cb;
  return () => {
    if (capture === cb) capture = null;
  };
}

/** CC-driven hi-hat openness, shared by the resolver and the meter UI. */
export const hihat = new HiHatState();

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

// ---- Open-hat ring indicator: voice id → pad, cleared when the voice ends or is choked. ----
let boundEngine: AudioEngine | null = null;
const ringVoices = new Map<number, number>();
function bindEngine(engine: AudioEngine) {
  if (boundEngine === engine) return;
  boundEngine = engine;
  ringVoices.clear();
  engine.onVoiceEnd((voice) => {
    const pad = ringVoices.get(voice.id);
    if (pad === undefined) return;
    ringVoices.delete(voice.id);
    if (![...ringVoices.values()].includes(pad)) ringPad(pad, false);
  });
}

/** Available openness levels of the current kit, closed → open. */
function opennessLevels(): readonly string[] {
  const kit = useKitStore.getState();
  return (kit.manifest?.hihat?.openness ?? []).filter((l) => kit.available.has(l));
}

export function resolvePadVoice(voice: Voice): string | null {
  const kit = useKitStore.getState();
  const levels = opennessLevels();
  return resolve(voice, {
    available: kit.available,
    hihatOpenness: levels,
    hihatLevel: hihat.level(useMappingStore.getState().mapping.hihat.invert, levels.length),
  });
}

/** Human label of the level the CC pad would play now, e.g. "hihat.half". */
export function currentHihatArticulation(): string | null {
  return resolvePadVoice('hihat.cc');
}

export function padForNote(note: number): number | undefined {
  return byNote.get(note);
}

function play(i: number, inVelocity: number, velocity: number, eventTime: number, source: HitInfo['source']) {
  const pad = byIndex[i];
  if (!pad) return;
  const engine = getRuntime().engine;
  bindEngine(engine);
  const articulationId = resolvePadVoice(pad.voice);
  if (articulationId) {
    const voice = engine.trigger(articulationId, velocity, eventTime);
    if (voice && voice.group === 'hihat' && voice.chokedBy.length > 0) {
      ringVoices.set(voice.id, i);
      ringPad(i, true);
    }
  } else if (CHOKE_ONLY.has(pad.voice)) {
    engine.choke(pad.voice); // kit has no choke sample: just silence the cymbal
  }
  flashPad(i, velocity);
  if (useUiStore.getState().editing) useUiStore.getState().selectPad(i); // editor follows what you hit
  lastHit = { padIndex: i, voice: pad.voice, articulationId, inVelocity, velocity, source };
  for (const l of hitListeners) l(lastHit);
}

/** On-screen pads and the computer keyboard: velocity is used as-is (no curve). */
export function hitPad(i: number, velocity: number, eventTime: number = performance.now()): void {
  play(i, velocity, velocity, eventTime, 'ui');
}

function hihatCC(value: number, mapping: Mapping) {
  const { invert, pedalOnClose } = mapping.hihat;
  const before = hihat.band(invert);
  hihat.value = value;
  if (pedalOnClose && before > 0 && hihat.band(invert) === 0) {
    const engine = getRuntime().engine;
    if (engine.activeVoices.some((v) => v.group === 'hihat' && v.chokedBy.length > 0)) {
      const pedal = resolvePadVoice('hihat.pedal');
      if (pedal) engine.trigger(pedal, PEDAL_ON_CLOSE_VELOCITY);
    }
  }
  for (const l of hihatListeners) l(value);
}

export function handleMidi(message: MidiMessage, eventTime: number): void {
  const { mapping } = useMappingStore.getState();
  if (mapping.channel !== null && message.channel !== mapping.channel) return;
  if (message.type === 'cc') {
    if (message.controller === mapping.hihat.cc) hihatCC(message.value, mapping);
    return;
  }
  if (message.type !== 'noteon') return; // drums are one-shots
  if (capture) {
    const cb = capture;
    capture = null;
    cb(message.note);
    return;
  }
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

export function onHihatChange(listener: (value: number | null) => void): () => void {
  hihatListeners.add(listener);
  return () => hihatListeners.delete(listener);
}
