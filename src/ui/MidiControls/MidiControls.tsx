import { useEffect, useId, useState } from 'react';
import { Dialog } from '@/ui/primitives/Dialog';
import { learnControl } from '@/app/controls';
import { useControlsStore } from '@/state/useControlsStore';
import { useMappingStore } from '@/state/useMappingStore';
import { voiceLabel } from '@/mapping/voices';
import {
  BUTTON_ACTIONS,
  ENCODER_ACTIONS,
  ENCODER_MODES,
  KNOB_ACTIONS,
  type ControlAction,
  type ControlSource,
  type EncoderMode,
} from '@/midi/controls';

const LEARN_TIMEOUT_MS = 10_000;

export const ACTION_LABELS: Record<ControlAction, string> = {
  'kit.next': 'Next kit',
  'kit.prev': 'Previous kit',
  'rotation.toggle': 'Start / stop rotation',
  'tempo.tap': 'Tap tempo',
  'layout.next': 'Next pad layout',
  'kitList.load': 'Load highlighted kit',
  'mix.master': 'Master volume',
  'mix.kick': 'Kick volume',
  'mix.snare': 'Snare volume',
  'mix.hihat': 'Hi-hat volume',
  'mix.toms': 'Toms volume',
  'mix.cymbals': 'Cymbals volume',
  'mix.perc': 'Percussion volume',
  'velocity.sensitivity': 'Sensitivity',
  'velocity.hardest': 'Hardest hit',
  'kitList.scroll': 'Scroll kit list',
};

const ENCODER_MODE_LABELS: Record<EncoderMode, string> = {
  relative: 'Relative (1 = right, 127 = left)',
  offset: 'Relative (64 = centre)',
  absolute: 'Absolute (0–127)',
};

export function describeSource(s: ControlSource): string {
  return `${s.kind === 'cc' ? 'CC' : 'Note'} ${s.number}${s.channel !== 1 ? ` · ch ${s.channel}` : ''}`;
}

function useConflict(source: ControlSource | undefined): string | null {
  const mapping = useMappingStore((s) => s.mapping);
  if (!source) return null;
  if (source.kind === 'note') {
    const pad = mapping.pads.find((p) => p.note === source.number);
    if (pad)
      return `Also pad “${pad.label ?? voiceLabel(pad.voice)}”: that pad will not play from this note.`;
  } else if (source.number === mapping.hihat.cc) {
    return 'Also the hi-hat controller: it will no longer move the hi-hat.';
  }
  return null;
}

function Row({
  action,
  learning,
  onLearn,
}: {
  action: ControlAction;
  learning: boolean;
  onLearn: (on: boolean) => void;
}) {
  const source = useControlsStore((s) => s.bindings.find((b) => b.action === action)?.source);
  const bind = useControlsStore((s) => s.bind);
  const conflict = useConflict(source);
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm text-fg-0">{ACTION_LABELS[action]}</span>
        <span className="w-24 font-mono text-xs text-fg-1" data-testid={`binding-${action}`}>
          {learning ? 'Move it…' : source ? describeSource(source) : '—'}
        </span>
        <button
          type="button"
          aria-pressed={learning}
          aria-label={`Learn ${ACTION_LABELS[action]}`}
          onClick={() => onLearn(!learning)}
          className="rounded-m border border-line px-2.5 py-1 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0 aria-pressed:border-dashed aria-pressed:border-accent aria-pressed:text-accent"
        >
          {learning ? 'Cancel' : 'Learn'}
        </button>
        <button
          type="button"
          aria-label={`Clear ${ACTION_LABELS[action]}`}
          disabled={!source}
          onClick={() => bind(action, null)}
          className="rounded-s px-1.5 py-1 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0 disabled:invisible"
        >
          ✕
        </button>
      </div>
      {conflict && <p className="text-xs text-warn">{conflict}</p>}
    </li>
  );
}

function Section({
  title,
  hint,
  actions,
  learning,
  setLearning,
}: {
  title: string;
  hint: string;
  actions: readonly ControlAction[];
  learning: ControlAction | null;
  setLearning: (a: ControlAction | null) => void;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wider text-fg-2 uppercase">{title}</h3>
      <p className="text-xs text-fg-1">{hint}</p>
      <ul className="divide-y divide-line">
        {actions.map((a) => (
          <Row key={a} action={a} learning={learning === a} onLearn={(on) => setLearning(on ? a : null)} />
        ))}
      </ul>
    </section>
  );
}

/** Assign controller buttons, knobs and the encoder to app actions by MIDI learn. */
export function MidiControls({ onClose }: { onClose: () => void }) {
  const [learning, setLearning] = useState<ControlAction | null>(null);
  const programChange = useControlsStore((s) => s.programChangeSelectsKit);
  const encoderMode = useControlsStore((s) => s.encoderMode);
  const setControls = useControlsStore((s) => s.set);
  const reset = useControlsStore((s) => s.reset);
  const modeId = useId();

  useEffect(() => {
    if (!learning) return;
    const cancel = learnControl(learning, () => setLearning(null));
    const timeout = setTimeout(() => setLearning(null), LEARN_TIMEOUT_MS);
    return () => {
      cancel();
      clearTimeout(timeout);
    };
  }, [learning]);

  return (
    <Dialog open title="MIDI controls" onClose={onClose}>
      <p className="text-sm text-fg-1">
        Use the buttons, knobs and encoder on your controller to drive the app. Press <b>Learn</b>, then press
        or turn the control. Maschine controllers must be in MIDI mode, not controlling the Maschine software.
      </p>
      <Section
        title="Buttons"
        hint="Fire when pressed. Notes or CCs both work."
        actions={BUTTON_ACTIONS}
        learning={learning}
        setLearning={setLearning}
      />
      <Section
        title="Knobs"
        hint="Absolute knobs or faders (CC 0–127). Volumes reach 0 dB at about 70 %."
        actions={KNOB_ACTIONS}
        learning={learning}
        setLearning={setLearning}
      />
      <Section
        title="Encoder"
        hint="Turn to highlight a kit in the list, then press the button you learned as “Load highlighted kit”."
        actions={ENCODER_ACTIONS}
        learning={learning}
        setLearning={setLearning}
      />
      <div className="flex flex-col gap-3 border-t border-line pt-4 text-sm">
        <label htmlFor={modeId} className="flex items-center justify-between gap-3 text-fg-1">
          Encoder sends
          <select
            id={modeId}
            value={encoderMode}
            onChange={(e) => setControls({ encoderMode: e.target.value as EncoderMode })}
            className="rounded-m border border-line bg-bg-2 px-2 py-1 text-xs text-fg-0"
          >
            {ENCODER_MODES.map((m) => (
              <option key={m} value={m}>
                {ENCODER_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-fg-1">
          <input
            type="checkbox"
            checked={programChange}
            onChange={(e) => setControls({ programChangeSelectsKit: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          Program change selects a kit (program 1 = first kit in the list)
        </label>
        <button
          type="button"
          onClick={() => {
            setLearning(null);
            reset();
          }}
          className="self-start rounded-m border border-line px-3 py-1.5 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0"
        >
          Clear all assignments
        </button>
      </div>
    </Dialog>
  );
}
