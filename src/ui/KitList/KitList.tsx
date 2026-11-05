import { useEffect, useId, useRef } from 'react';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useUiStore } from '@/state/useUiStore';
import { BARS_CHOICES, MAX_BPM, MIN_BPM, SECONDS_CHOICES } from '@/kits/rotation';
import { canRotate, tapRotationTempo, toggleRotation, useRotationStore } from '@/app/rotation';

/** Thin bar that empties until the next kit switch. Updated per frame on the DOM node, not React state. */
function Countdown() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const { nextAt, interval } = useRotationStore.getState();
      if (bar.current && nextAt !== null && interval > 0) {
        const left = Math.min(1, Math.max(0, (nextAt - performance.now()) / interval));
        bar.current.style.transform = `scaleX(${left})`;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-bg-3">
      <div ref={bar} data-testid="rotation-countdown" className="h-full origin-left bg-accent" />
    </div>
  );
}

function RotationControls() {
  const rotation = useSettingsStore((s) => s.rotation);
  const setRotation = useSettingsStore((s) => s.setRotation);
  const running = useRotationStore((s) => s.running);
  // Re-evaluate when the list, the ticks or the current kit change.
  useKitStore((s) => s.index);
  useKitStore((s) => s.currentKitId);
  const possible = running || canRotate();
  const everyId = useId();
  const bpmId = useId();
  const every = rotation.mode === 'seconds' ? `s${rotation.seconds}` : `b${rotation.bars}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={running}
          disabled={!possible}
          onClick={toggleRotation}
          title={possible ? undefined : 'Tick at least one other kit to rotate through'}
          className="flex items-center gap-1.5 rounded-m border border-line px-2.5 py-1 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0 disabled:cursor-not-allowed disabled:hover:bg-transparent aria-pressed:border-accent aria-pressed:text-accent"
        >
          <span aria-hidden="true">⟳</span>
          {running ? 'Rotating' : 'Rotate kits'}
        </button>
        <label htmlFor={everyId} className="text-xs text-fg-2">
          every
        </label>
        <select
          id={everyId}
          value={every}
          onChange={(e) => {
            const v = e.target.value;
            const n = Number(v.slice(1));
            setRotation(v.startsWith('s') ? { mode: 'seconds', seconds: n } : { mode: 'bars', bars: n });
          }}
          className="min-w-0 flex-1 rounded-m border border-line bg-bg-2 px-2 py-1 text-xs text-fg-0 hover:bg-bg-3"
        >
          <optgroup label="Seconds">
            {SECONDS_CHOICES.map((n) => (
              <option key={n} value={`s${n}`}>
                {n} s
              </option>
            ))}
          </optgroup>
          <optgroup label="Bars (4/4)">
            {BARS_CHOICES.map((n) => (
              <option key={n} value={`b${n}`}>
                {n} {n === 1 ? 'bar' : 'bars'}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {rotation.mode === 'bars' && (
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor={bpmId} className="text-fg-2">
            Tempo
          </label>
          <input
            id={bpmId}
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={rotation.bpm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= MIN_BPM && v <= MAX_BPM) setRotation({ bpm: v });
            }}
            className="w-16 rounded-s border border-line bg-bg-2 px-2 py-1 font-mono text-fg-0"
          />
          <span className="text-fg-2">BPM</span>
          <button
            type="button"
            onClick={() => tapRotationTempo()}
            title="Tap on the beat, starting on the 1; bar changes then land on your downbeat"
            className="ml-auto rounded-m border border-line px-2.5 py-1 text-fg-1 hover:bg-bg-3 hover:text-fg-0"
          >
            Tap
          </button>
        </div>
      )}
      {running && <Countdown />}
    </div>
  );
}

/**
 * Left-column kit browser: every kit in one scrolling list, click to load, tick to include in
 * rotation. The controller encoder highlights a row (kit cursor) and its push loads it.
 */
export function KitList() {
  const index = useKitStore((s) => s.index);
  const currentKitId = useKitStore((s) => s.currentKitId);
  const ticked = useSettingsStore((s) => s.rotation.kitIds);
  const setRotation = useSettingsStore((s) => s.setRotation);
  const kitCursor = useUiStore((s) => s.kitCursor);
  const listId = useId();

  // Keep the encoder's highlighted kit, or else the playing kit, in view.
  const focusId = kitCursor ?? currentKitId;
  useEffect(() => {
    if (!focusId) return;
    const i = index.findIndex((k) => k.id === focusId);
    document.getElementById(`${listId}-${i}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [focusId, index, listId]);

  const toggle = (id: string, on: boolean) =>
    setRotation({ kitIds: on ? [...ticked, id] : ticked.filter((k) => k !== id) });
  const tickedCount = index.filter((k) => ticked.includes(k.id)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <RotationControls />
      <ul aria-label="Drum kits" className="-mx-2 min-h-0 flex-1 overflow-y-auto">
        {index.map((kit, i) => {
          const selected = kit.id === currentKitId;
          return (
            <li
              key={kit.id}
              id={`${listId}-${i}`}
              data-cursor={kit.id === kitCursor || undefined}
              className="flex items-center gap-1 rounded-m pr-2 data-cursor:bg-bg-3 data-cursor:outline data-cursor:outline-accent/60"
            >
              <button
                type="button"
                aria-current={selected || undefined}
                onClick={() => {
                  useUiStore.getState().setKitCursor(null);
                  if (!selected) void useKitStore.getState().switchKit(kit.id);
                }}
                title={kit.description}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-m px-2 py-1.5 text-left text-sm hover:bg-bg-3"
              >
                <span aria-hidden="true" className="w-2 shrink-0 text-[10px] text-accent">
                  {selected ? '●' : ''}
                </span>
                <span className={`truncate ${selected ? 'font-medium text-fg-0' : 'text-fg-1'}`}>
                  {kit.name}
                </span>
                {kit.baseUrl && (
                  <span
                    className="ml-auto shrink-0 rounded-s border border-warn/50 px-1 font-mono text-[10px] text-warn"
                    title="Built on this computer, not deployed"
                  >
                    local
                  </span>
                )}
              </button>
              <input
                type="checkbox"
                aria-label={`Rotate through ${kit.name}`}
                title="Include in rotation"
                checked={ticked.includes(kit.id)}
                onChange={(e) => toggle(kit.id, e.target.checked)}
                className="size-3.5 shrink-0 cursor-pointer accent-[var(--accent)]"
              />
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-fg-2" data-testid="rotation-hint">
        {tickedCount === 0
          ? 'Rotation plays every kit. Tick kits to choose a shortlist.'
          : `Rotation plays the ${tickedCount} ticked ${tickedCount === 1 ? 'kit' : 'kits'}.`}
      </p>
    </div>
  );
}
