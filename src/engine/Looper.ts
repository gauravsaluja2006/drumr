/**
 * Pad looper: records pad hits and hi-hat pedal moves, then replays them in a loop. Pure state and
 * timing (times are performance.now() ms passed in by the caller); src/app/looper.ts owns the
 * timers and turns due events into engine triggers.
 *
 * Phases: idle → armed (waiting for the first hit) → recording → playing ⇄ overdub, and stopped.
 * The first hit is frame 0. Closing the loop sets its length; playback continues from wherever
 * the bar grid says it is, so a "free" loop restarts at frame 0 exactly at the press (no gap).
 */
export type LoopPhase = 'idle' | 'armed' | 'recording' | 'playing' | 'overdub' | 'stopped';

export type LoopInput =
  { kind: 'hit'; pad: number; voice: string; velocity: number } | { kind: 'cc'; value: number };

/** `t`: ms from frame 0. `layer`: 0 = first take, 1+ = overdubs. */
export type LoopEvent = LoopInput & { t: number; layer: number };

export type LoopDue =
  { kind: 'boundary'; at: number; pass: number } | { kind: 'event'; at: number; event: LoopEvent };

/** Hits this close to the end of a free loop are the player starting the next pass, not part of it. */
export const TAIL_MS = 40;
export const MIN_LOOP_MS = 250;
export const MAX_LOOP_MS = 120_000;

export class Looper {
  phase: LoopPhase = 'idle';
  /** Loop length in ms; 0 until closed. */
  length = 0;
  /** performance.now() of frame 0 of pass 0; pass n starts at start + n × length. */
  start = 0;
  /** Number of recorded layers (first take included). */
  layers = 0;
  private list: LoopEvent[] = [];

  get events(): readonly LoopEvent[] {
    return this.list;
  }

  get hasLoop(): boolean {
    return this.length > 0;
  }

  arm(): void {
    if (this.phase === 'idle') this.phase = 'armed';
  }

  /**
   * Feed a live input. Armed: a hit starts recording at `time` (and `hihat`, the pedal position
   * then, is stored at frame 0). Recording/overdub: stored. Returns whether it was recorded.
   */
  input(e: LoopInput, time: number, hihat: number | null = null): boolean {
    if (this.phase === 'armed') {
      if (e.kind !== 'hit') return false;
      this.phase = 'recording';
      this.start = time;
      this.layers = 1;
      this.list = hihat === null ? [] : [{ kind: 'cc', value: hihat, t: 0, layer: 0 }];
      this.list.push({ ...e, t: 0, layer: 0 });
      return true;
    }
    if (this.phase === 'recording') {
      this.list.push({ ...e, t: time - this.start, layer: 0 });
      return true;
    }
    if (this.phase === 'overdub') {
      this.insert({ ...e, t: this.position(time), layer: this.layers - 1 });
      return true;
    }
    return false;
  }

  /** Recording has hit the length limit and should be closed. */
  isFull(time: number): boolean {
    return this.phase === 'recording' && time - this.start >= MAX_LOOP_MS;
  }

  /**
   * Ends recording at `time` and starts playback. With `barMs`, the length rounds to the nearest
   * whole bar (at least one). Returns false (and resets) when there was nothing usable.
   */
  close(time: number, opts: { barMs?: number } = {}): boolean {
    if (this.phase !== 'recording') {
      if (this.phase === 'armed') this.phase = 'idle';
      return false;
    }
    const raw = Math.min(MAX_LOOP_MS, time - this.start);
    const length = opts.barMs ? Math.max(1, Math.round(raw / opts.barMs)) * opts.barMs : raw;
    if (length < MIN_LOOP_MS) {
      this.clear();
      return false;
    }
    const tail = opts.barMs ? 0 : TAIL_MS;
    this.list = this.list.filter(
      (e) => e.t < length && (e.t === 0 || e.kind !== 'hit' || e.t <= length - tail),
    );
    this.length = length;
    this.phase = 'playing';
    return true;
  }

  toggleOverdub(): void {
    if (this.phase === 'playing') {
      this.phase = 'overdub';
      this.layers++;
    } else if (this.phase === 'overdub') {
      this.phase = 'playing';
      if (!this.list.some((e) => e.layer === this.layers - 1)) this.layers--; // nothing added
    }
  }

  stop(): void {
    if (this.phase === 'overdub') this.toggleOverdub();
    if (this.phase === 'playing') this.phase = 'stopped';
    else if (this.phase === 'armed') this.phase = 'idle';
  }

  /** Restart a stopped loop from frame 0 at `time`. */
  play(time: number): void {
    if (this.phase !== 'stopped') return;
    this.start = time;
    this.phase = 'playing';
  }

  /** Remove the newest overdub layer. The first take stays (use clear). */
  undo(): void {
    if (this.layers < 2) return;
    if (this.phase === 'overdub') this.toggleOverdub();
    const top = this.layers - 1;
    this.list = this.list.filter((e) => e.layer !== top);
    this.layers--;
  }

  clear(): void {
    this.phase = 'idle';
    this.length = 0;
    this.start = 0;
    this.layers = 0;
    this.list = [];
  }

  /** ms into the current pass. */
  position(time: number): number {
    if (!this.length) return 0;
    const p = (time - this.start) % this.length;
    return p < 0 ? p + this.length : p;
  }

  /** Pass boundaries and events whose absolute time is in (from, to], in time order. */
  due(from: number, to: number): LoopDue[] {
    if ((this.phase !== 'playing' && this.phase !== 'overdub') || !this.length || to <= from) return [];
    const out: LoopDue[] = [];
    const first = Math.floor((from - this.start) / this.length);
    const last = Math.floor((to - this.start) / this.length);
    for (let pass = first; pass <= last; pass++) {
      const base = this.start + pass * this.length;
      if (base > from && base <= to) out.push({ kind: 'boundary', at: base, pass });
      for (const event of this.list) {
        const at = base + event.t;
        if (at > from && at <= to) out.push({ kind: 'event', at, event });
      }
    }
    return out;
  }

  private insert(e: LoopEvent) {
    let i = this.list.length;
    while (i > 0 && this.list[i - 1]!.t > e.t) i--;
    this.list.splice(i, 0, e);
  }
}
