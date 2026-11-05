import {
  actionKind,
  encoderDelta,
  isPress,
  knobToDb,
  knobToRange,
  matchesKind,
  messageKey,
  sourceKey,
  sourceOf,
  type ControlAction,
  type ControlBinding,
} from '@/midi/controls';
import type { MidiMessage } from '@/midi/types';
import { nextKitId } from '@/kits/rotation';
import { sensitivityToExponent } from '@/engine/velocity';
import type { Group } from '@/kits/schema';
import { BUILTIN_PRESETS } from '@/mapping/presets';
import { useControlsStore } from '@/state/useControlsStore';
import { useKitStore } from '@/state/useKitStore';
import { useMappingStore } from '@/state/useMappingStore';
import { useSettingsStore } from '@/state/useSettingsStore';
import { useUiStore } from '@/state/useUiStore';
import { tapRotationTempo, toggleRotation } from './rotation';
import { loopClear, loopMain, loopPlay, loopStop, loopStopPlay, loopUndo } from './looper';

/**
 * Controller buttons, knobs and encoders → app actions (kit, rotation, mixer, velocity).
 * Called from handleMidi before pad lookup; a bound note does not play its pad. Lookups are a
 * single Map.get on a numeric key, so unbound pad notes pay almost nothing.
 */
let byKey = new Map<number, ControlAction>();
let learn: { action: ControlAction; cb: (b: ControlBinding) => void } | null = null;
let lastEncoder: number | undefined;

function index(bindings: readonly ControlBinding[]) {
  byKey = new Map(bindings.map((b) => [sourceKey(b.source), b.action]));
}
index(useControlsStore.getState().bindings);
useControlsStore.subscribe((s, prev) => {
  if (s.bindings !== prev.bindings) index(s.bindings);
});

/** MIDI learn for a control: the next matching message is bound to `action`. Returns a cancel function. */
export function learnControl(action: ControlAction, cb?: (b: ControlBinding) => void): () => void {
  const entry = {
    action,
    cb: (b: ControlBinding) => {
      useControlsStore.getState().bind(b.action, b.source);
      cb?.(b);
    },
  };
  learn = entry;
  return () => {
    if (learn === entry) learn = null;
  };
}

export function isLearningControl(): boolean {
  return learn !== null;
}

/** Steps the kit-list cursor (encoder) from the highlighted kit, or from the playing kit. */
export function moveKitCursor(steps: number): void {
  if (steps === 0) return;
  const ids = useKitStore.getState().index.map((k) => k.id);
  const ui = useUiStore.getState();
  const from = ui.kitCursor ?? useKitStore.getState().currentKitId;
  const i = from === null ? -1 : ids.indexOf(from);
  const next = ids[Math.min(ids.length - 1, Math.max(0, i + steps))];
  if (next) ui.setKitCursor(next);
}

export function stepKit(step: 1 | -1): void {
  const kits = useKitStore.getState();
  const next = nextKitId(
    kits.index.map((k) => k.id),
    kits.currentKitId,
    step,
  );
  if (next) void kits.switchKit(next);
}

function nextLayout() {
  const m = useMappingStore.getState();
  const ids = [...BUILTIN_PRESETS.map((p) => p.id), ...m.customPresets.map((p) => p.id)];
  const next = ids[(ids.indexOf(m.presetId) + 1) % ids.length];
  if (next) m.setPreset(next);
}

function press(action: ControlAction) {
  switch (action) {
    case 'kit.next':
      return stepKit(1);
    case 'kit.prev':
      return stepKit(-1);
    case 'rotation.toggle':
      return toggleRotation();
    case 'tempo.tap':
      return tapRotationTempo();
    case 'layout.next':
      return nextLayout();
    case 'loop.record':
      return loopMain();
    case 'loop.play':
      return loopPlay();
    case 'loop.stop':
      return loopStop();
    case 'loop.stopPlay':
      return loopStopPlay();
    case 'loop.undo':
      return loopUndo();
    case 'loop.clear':
      return loopClear();
    case 'kitList.load': {
      const id = useUiStore.getState().kitCursor;
      if (id && id !== useKitStore.getState().currentKitId) void useKitStore.getState().switchKit(id);
      useUiStore.getState().setKitCursor(null);
      return;
    }
  }
}

function turn(action: ControlAction, value: number) {
  if (action === 'mix.master') return useSettingsStore.getState().setMasterDb(knobToDb(value));
  if (action === 'velocity.sensitivity')
    return useMappingStore
      .getState()
      .setVelocity({ exponent: sensitivityToExponent(knobToRange(value, 0, 100)) });
  if (action === 'velocity.hardest')
    return useMappingStore.getState().setVelocity({ ceiling: knobToRange(value, 32, 127) });
  if (action.startsWith('mix.')) {
    const kitId = useKitStore.getState().currentKitId;
    if (kitId) useSettingsStore.getState().setGroup(kitId, action.slice(4) as Group, { db: knobToDb(value) });
  }
}

/** Handles a controller message if it is bound (or being learned). Returns true when consumed. */
export function handleControl(m: MidiMessage): boolean {
  if (m.type === 'program') {
    if (!useControlsStore.getState().programChangeSelectsKit) return false;
    const kit = useKitStore.getState().index[m.program];
    if (kit && kit.id !== useKitStore.getState().currentKitId) void useKitStore.getState().switchKit(kit.id);
    return true;
  }
  if (learn) {
    const source = sourceOf(m);
    if (source && matchesKind(actionKind(learn.action), m)) {
      const { action, cb } = learn;
      learn = null;
      cb({ action, source });
      return true;
    }
    return m.type === 'noteoff' || m.type === 'cc'; // swallow releases and stray CCs while learning
  }
  const key = messageKey(m);
  const action = key === null ? undefined : byKey.get(key);
  if (action === undefined) return false;
  const kind = actionKind(action);
  if (kind === 'button') {
    if (isPress(m)) press(action);
  } else if (m.type === 'cc') {
    if (kind === 'knob') turn(action, m.value);
    else {
      moveKitCursor(encoderDelta(m.value, useControlsStore.getState().encoderMode, lastEncoder));
      lastEncoder = m.value;
    }
  }
  return true;
}
