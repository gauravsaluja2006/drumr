import { create } from 'zustand';
import { Looper, type LoopPhase } from '@/engine/Looper';
import type { Voice } from '@/mapping/voices';
import { barMs } from '@/kits/rotation';
import { useSettingsStore } from '@/state/useSettingsStore';
import { getRuntime } from './runtime';
import { hihat, onHihatChange, onHit, playLoopHihat, playLoopHit } from './controller';
import { alignRotationTo } from './rotation';

/**
 * Loop runtime: feeds live hits into the Looper and plays the loop back with a look-ahead
 * scheduler. Every TICK_MS it hands the engine whatever falls in the next LOOKAHEAD_MS, timed on
 * the audio clock, so main-thread hiccups shorter than the look-ahead do not move a hit.
 */
export const looper = new Looper();

export interface LoopView {
  phase: LoopPhase;
  length: number;
  start: number;
  layers: number;
  /** Events in the loop (shown as a count). */
  events: number;
}

const view = (): LoopView => ({
  phase: looper.phase,
  length: looper.length,
  start: looper.start,
  layers: looper.layers,
  events: looper.events.length,
});

export const useLoopStore = create<LoopView>()(view);
const sync = () => useLoopStore.setState(view());
/** From the hit path: React hears about it on the next frame, never synchronously (CLAUDE.md). */
let frame = 0;
const syncSoon = () => {
  if (!frame)
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
};

export const LOOKAHEAD_MS = 30;
const TICK_MS = 10;
/** After a stall longer than this (background tab), skip ahead instead of firing a burst of hits. */
const MAX_CATCH_UP_MS = 200;

let timer: ReturnType<typeof setTimeout> | undefined;
let watchdog: ReturnType<typeof setInterval> | undefined;
let scheduledUntil = 0;
const boundaryListeners = new Set<(pass: number, at: number) => void>();

/** Called synchronously at each pass start, before that pass's frame-0 hits are scheduled. */
export function onLoopBoundary(listener: (pass: number, at: number) => void): () => void {
  boundaryListeners.add(listener);
  return () => boundaryListeners.delete(listener);
}

function toAudioTime(at: number): number {
  const ctx = getRuntime().ctx;
  return ctx.currentTime + Math.max(0, at - performance.now()) / 1000;
}

function tick() {
  const now = performance.now();
  if (now - scheduledUntil > MAX_CATCH_UP_MS) scheduledUntil = now;
  const to = now + LOOKAHEAD_MS;
  for (const d of looper.due(scheduledUntil, to)) {
    if (d.kind === 'boundary') for (const l of boundaryListeners) l(d.pass, d.at);
    else if (d.event.kind === 'hit')
      playLoopHit(d.event.pad, d.event.voice as Voice, d.event.velocity, toAudioTime(d.at));
    else playLoopHihat(d.event.value);
  }
  scheduledUntil = to;
  timer = setTimeout(tick, TICK_MS);
}

function startPlayback(from: number) {
  clearTimeout(timer);
  scheduledUntil = from - 0.001; // include a frame-0 hit due exactly now
  tick();
}

function stopPlayback() {
  clearTimeout(timer);
  timer = undefined;
}

function closeLoop(now: number) {
  clearInterval(watchdog);
  const bars = useSettingsStore.getState().loopLength === 'bars';
  const bar = barMs(useSettingsStore.getState().rotation.bpm);
  if (looper.close(now, bars ? { barMs: bar } : {})) {
    startPlayback(now);
    if (bars) alignRotationTo(looper.start); // bar-mode rotation lands on the loop's "1"
  }
}

let installed: (() => void) | null = null;

/** Hooks live input into the looper. Idempotent; returns an uninstall function (tests). */
export function installLooper(): () => void {
  if (installed) return installed;
  const offHit = onHit((hit) => {
    if (hit.source === 'loop') return;
    const before = looper.phase;
    const value = hihat.value;
    if (
      !looper.input(
        { kind: 'hit', pad: hit.padIndex, voice: hit.voice, velocity: hit.velocity },
        hit.time,
        value,
      )
    )
      return;
    if (before === 'armed') {
      syncSoon();
      watchdog = setInterval(() => {
        if (looper.isFull(performance.now())) {
          closeLoop(performance.now());
          sync();
        }
      }, 1000);
    } else if (before === 'overdub') syncSoon();
  });
  const offHihat = onHihatChange((value, fromLoop) => {
    if (!fromLoop && value !== null) looper.input({ kind: 'cc', value }, performance.now());
  });
  installed = () => {
    offHit();
    offHihat();
    installed = null;
  };
  return installed;
}

/**
 * The loop button: arm → (first hit records) → close and play → overdub ⇄ play; on a stopped loop,
 * play from frame 0. Pressing it while armed cancels.
 */
export function loopMain(now: number = performance.now()): void {
  switch (looper.phase) {
    case 'idle':
      looper.arm();
      break;
    case 'armed':
      looper.close(now); // nothing recorded yet: cancels
      break;
    case 'recording':
      closeLoop(now);
      break;
    case 'playing':
    case 'overdub':
      looper.toggleOverdub();
      break;
    case 'stopped':
      looper.play(now);
      startPlayback(now);
      break;
  }
  sync();
}

/** Stop / play: stops a playing loop, restarts a stopped one from frame 0, ends a recording without playing it. */
export function loopStopPlay(now: number = performance.now()): void {
  if (looper.phase === 'stopped') {
    looper.play(now);
    startPlayback(now);
  } else if (looper.phase === 'recording') {
    closeLoop(now);
    stopPlayback();
    looper.stop();
  } else {
    stopPlayback();
    looper.stop();
  }
  sync();
}

export function loopUndo(): void {
  looper.undo();
  sync();
}

export function loopClear(): void {
  stopPlayback();
  clearInterval(watchdog);
  looper.clear();
  sync();
}
