import { useEffect, useRef, useState } from 'react';
import { useMidiStore } from '@/state/useMidiStore';
import { getRuntime } from '@/app/runtime';
import type { MidiStatus as Status } from '@/midi/types';

const DOT: Record<Status, string> = {
  connected: 'bg-ok shadow-[0_0_8px_var(--ok)]',
  'no-device': 'border border-fg-2',
  pending: 'bg-warn animate-pulse',
  unsupported: 'bg-warn',
  denied: 'bg-err',
  error: 'bg-err',
};

/** Status pill and device picker (docs/03-DESIGN.md §4.2). */
export function MidiStatus() {
  const { status, inputs, selectedId, listening } = useMidiStore();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const device = inputs.find((d) => d.id === selectedId);

  const text =
    status === 'connected'
      ? `Connected · ${device?.name ?? ''}`
      : status === 'no-device'
        ? listening
          ? 'Hit a pad to connect…'
          : inputs.length > 0
            ? 'Choose MIDI device…'
            : 'No MIDI device'
        : status === 'pending'
          ? 'MIDI…'
          : status === 'unsupported'
            ? 'MIDI not supported'
            : status === 'denied'
              ? 'MIDI blocked'
              : 'MIDI error';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="midi-status"
        data-status={status}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[16rem] items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-fg-1 hover:bg-bg-2"
      >
        <span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${listening ? 'animate-pulse bg-accent' : DOT[status]}`}
        />
        <span className="truncate">{text}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="MIDI devices"
          className="absolute top-full right-0 z-30 mt-2 w-72 rounded-l border border-line bg-bg-1 p-1.5 text-sm shadow-2xl"
        >
          {inputs.length === 0 && (
            <p className="px-3 py-2 text-fg-1">
              {status === 'unsupported'
                ? 'This browser has no Web MIDI. Use Chrome, Edge or Firefox, or play with the keyboard.'
                : status === 'denied'
                  ? 'MIDI access was blocked.'
                  : 'Plug in a USB MIDI controller. It appears here automatically.'}
            </p>
          )}
          {listening && (
            <p className="px-3 pt-1 pb-2 text-xs text-fg-1">
              Hit any pad on your controller to connect it, or choose it below.
            </p>
          )}
          {inputs.map((d) => (
            <button
              key={d.id}
              type="button"
              role="menuitemradio"
              aria-checked={d.id === selectedId}
              onClick={() => {
                getRuntime().midi.select(d.id === selectedId ? null : d.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-m px-3 py-2 text-left hover:bg-bg-3"
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${d.id === selectedId ? 'bg-ok' : 'border border-fg-2'}`}
              />
              {d.name}
            </button>
          ))}
          {(status === 'denied' || status === 'error') && (
            <button
              type="button"
              role="menuitem"
              onClick={() => void getRuntime().midi.init()}
              className="w-full rounded-m px-3 py-2 text-left text-accent hover:bg-bg-3"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Persistent explanation under the status bar when MIDI cannot work (US-12). */
export function MidiBanner() {
  const status = useMidiStore((s) => s.status);
  if (status !== 'unsupported' && status !== 'denied' && status !== 'error') return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 border-b border-line bg-warn/10 px-4 py-2 text-xs text-fg-0"
    >
      <span>
        {status === 'unsupported'
          ? 'MIDI isn’t supported in this browser. Use the keyboard (1234 / QWER / ASDF / ZXCV) or tap the pads.'
          : 'MIDI access was blocked. The keyboard and on-screen pads still work.'}
      </span>
      {status !== 'unsupported' && (
        <button
          type="button"
          onClick={() => void getRuntime().midi.init()}
          className="rounded-s border border-line px-2 py-0.5 hover:bg-bg-3"
        >
          Retry
        </button>
      )}
    </div>
  );
}
