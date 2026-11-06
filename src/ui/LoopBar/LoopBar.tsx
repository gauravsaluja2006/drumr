import { useEffect, useId, useRef } from 'react';
import { loopClear, loopMain, loopStopPlay, loopUndo, looper, useLoopStore } from '@/app/looper';
import { useSettingsStore } from '@/state/useSettingsStore';
import type { LoopPhase } from '@/engine/Looper';

const MAIN_LABEL: Record<LoopPhase, string> = {
  idle: '● Record loop',
  armed: 'Hit a pad to start…',
  recording: '■ Close loop',
  playing: '● Overdub',
  overdub: 'Overdubbing: press to finish',
  stopped: '▶ Play loop',
};

const MAIN_HINT: Record<LoopPhase, string> = {
  idle: 'Arms the looper; recording starts on your first pad hit',
  armed: 'Waiting for your first hit. Press again to cancel',
  recording: 'Ends the loop here and plays it back from the first hit',
  playing: 'Record more hits on top of the loop',
  overdub: 'Stop adding hits; the loop keeps playing',
  stopped: 'Play the loop from its first hit',
};

/** Running time while recording, position bar while playing. Drawn per frame on DOM nodes. */
function LoopClock({ phase }: { phase: LoopPhase }) {
  const text = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const now = performance.now();
      if (phase === 'recording') {
        if (text.current) text.current.textContent = `${((now - looper.start) / 1000).toFixed(1)} s`;
      } else if (looper.length && bar.current) {
        bar.current.style.transform = `scaleX(${looper.position(now) / looper.length})`;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  if (phase === 'recording')
    return (
      <span ref={text} className="w-12 font-mono text-xs text-fg-1" data-testid="loop-time">
        0.0 s
      </span>
    );
  return (
    <div aria-hidden="true" className="h-1 w-24 overflow-hidden rounded-full bg-bg-3">
      <div
        ref={bar}
        className={`h-full origin-left ${phase === 'overdub' ? 'bg-err' : 'bg-accent'}`}
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}

/**
 * Pad looper controls (docs/03-DESIGN.md §4.10). L = main button, Shift+L = stop/play; every
 * action is also MIDI-learnable.
 */
export function LoopBar() {
  const { phase, length, layers } = useLoopStore();
  const loopLength = useSettingsStore((s) => s.loopLength);
  const setLoopLength = useSettingsStore((s) => s.setLoopLength);
  const bpm = useSettingsStore((s) => s.rotation.bpm);
  const lengthId = useId();
  const hasLoop = length > 0;
  const live = phase === 'recording' || phase === 'overdub';

  return (
    <section aria-label="Looper" className="flex flex-wrap items-center justify-center gap-2 text-xs">
      <button
        type="button"
        aria-pressed={phase !== 'idle' && phase !== 'stopped' && phase !== 'playing'}
        onClick={() => loopMain()}
        title={MAIN_HINT[phase]}
        data-phase={phase}
        className={`rounded-m border px-3 py-1.5 hover:bg-bg-3 ${
          live
            ? 'border-err text-fg-0'
            : phase === 'armed'
              ? 'border-dashed border-accent text-accent'
              : 'border-line text-fg-1 hover:text-fg-0'
        }`}
      >
        {MAIN_LABEL[phase]} <span className="ml-1 hidden font-mono text-fg-2 lg:inline">L</span>
      </button>
      {(phase === 'recording' || phase === 'playing' || phase === 'overdub') && <LoopClock phase={phase} />}
      {(hasLoop || phase === 'recording') && phase !== 'stopped' && (
        <button
          type="button"
          onClick={() => loopStopPlay()}
          title="Stop the loop (Shift+L)"
          className="rounded-m border border-line px-2.5 py-1.5 text-fg-1 hover:bg-bg-3 hover:text-fg-0"
        >
          ■ Stop
        </button>
      )}
      {layers > 1 && (
        <button
          type="button"
          onClick={loopUndo}
          title="Remove the last overdub"
          className="rounded-m border border-line px-2.5 py-1.5 text-fg-1 hover:bg-bg-3 hover:text-fg-0"
        >
          ↶ Undo
        </button>
      )}
      {(hasLoop || phase === 'armed' || phase === 'recording') && (
        <button
          type="button"
          onClick={loopClear}
          className="rounded-m border border-line px-2.5 py-1.5 text-fg-1 hover:bg-bg-3 hover:text-fg-0"
        >
          ✕ Clear
        </button>
      )}
      {hasLoop ? (
        <span className="font-mono text-fg-2" data-testid="loop-info">
          {(length / 1000).toFixed(1)} s{layers > 1 ? ` · ${layers} layers` : ''}
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <label htmlFor={lengthId} className="text-fg-2">
            Length
          </label>
          <select
            id={lengthId}
            value={loopLength}
            onChange={(e) => setLoopLength(e.target.value as 'free' | 'bars')}
            className="rounded-m border border-line bg-bg-2 px-2 py-1 text-fg-0 hover:bg-bg-3"
          >
            <option value="free">As played</option>
            <option value="bars">Whole bars at {bpm} BPM</option>
          </select>
        </span>
      )}
    </section>
  );
}
