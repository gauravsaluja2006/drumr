import { create } from 'zustand';
import { intervalMs, nextKitId, nextSwitchAt, rotationKits, tapTempo } from '@/kits/rotation';
import { useKitStore } from '@/state/useKitStore';
import { useSettingsStore } from '@/state/useSettingsStore';

/**
 * Kit rotation runtime: a timer that switches to the next ticked kit every N seconds or N bars,
 * preloading the kit after the current one so the switch is instant. Not on the MIDI → audio path.
 */
interface RotationRuntime {
  running: boolean;
  /** performance.now() of the next switch, for the countdown. */
  nextAt: number | null;
  interval: number;
  /** Downbeat from tap tempo; bar changes land on this grid. */
  tempoAnchor: number | null;
}

export const useRotationStore = create<RotationRuntime>()(() => ({
  running: false,
  nextAt: null,
  interval: 0,
  tempoAnchor: null,
}));

/** Bars mode switches this much before the downbeat so a hit right on it already plays the new kit. */
export const EARLY_MS = 40;
const MAX_TAPS = 16;

let timer: ReturnType<typeof setTimeout> | undefined;
let anchor = 0;
let switchingTo: string | null = null;
let taps: number[] = [];
let unsubscribe: (() => void) | null = null;

function rotationList(): string[] {
  return rotationKits(
    useKitStore.getState().index.map((k) => k.id),
    useSettingsStore.getState().rotation.kitIds,
  );
}

/** Rotation needs at least two kits; the ticks only narrow it down while it runs. */
export function canRotate(): boolean {
  return useKitStore.getState().index.length >= 2;
}

function preloadNext() {
  const kits = useKitStore.getState();
  const next = nextKitId(rotationList(), switchingTo ?? kits.currentKitId);
  if (next) void kits.preloadKit(next);
}

function schedule(after: number) {
  clearTimeout(timer);
  const s = useSettingsStore.getState().rotation;
  const interval = intervalMs(s);
  const at = nextSwitchAt(after, anchor, interval);
  const early = s.mode === 'bars' ? EARLY_MS : 0;
  timer = setTimeout(() => fire(at), Math.max(0, at - early - performance.now()));
  useRotationStore.setState({ nextAt: at, interval });
}

function fire(at: number) {
  const kits = useKitStore.getState();
  const next = nextKitId(rotationList(), kits.currentKitId);
  if (next) {
    switchingTo = next;
    void kits.switchKit(next).finally(() => {
      if (switchingTo === next) switchingTo = null;
      if (useRotationStore.getState().running) preloadNext();
    });
  }
  schedule(at);
}

function restartGrid() {
  const now = performance.now();
  const { tempoAnchor } = useRotationStore.getState();
  const s = useSettingsStore.getState().rotation;
  anchor = s.mode === 'bars' && tempoAnchor !== null ? tempoAnchor : now;
  schedule(now);
}

export function startRotation(): boolean {
  if (useRotationStore.getState().running || !canRotate()) return false;
  useRotationStore.setState({ running: true });
  restartGrid();
  preloadNext();
  unsubscribe = subscribe();
  return true;
}

export function stopRotation(): void {
  clearTimeout(timer);
  unsubscribe?.();
  unsubscribe = null;
  switchingTo = null;
  useRotationStore.setState({ running: false, nextAt: null });
}

export function toggleRotation(): void {
  if (useRotationStore.getState().running) stopRotation();
  else startRotation();
}

/** Tap tempo: sets the BPM and the bar grid's downbeat from the player's taps. */
export function tapRotationTempo(now: number = performance.now()): void {
  taps = [...taps, now].slice(-MAX_TAPS);
  const t = tapTempo(taps);
  if (!t) return;
  useRotationStore.setState({ tempoAnchor: t.anchor });
  useSettingsStore.getState().setRotation({ bpm: t.bpm }); // reschedules via the subscription
}

function subscribe(): () => void {
  const offSettings = useSettingsStore.subscribe((s, prev) => {
    if (s.rotation === prev.rotation) return;
    // Ticking only the playing kit does not stop rotation: it just stays put until another is ticked.
    const timing = (['mode', 'seconds', 'bars', 'bpm'] as const).some(
      (k) => s.rotation[k] !== prev.rotation[k],
    );
    if (timing) {
      // Seconds restart the countdown; bars keep the downbeat so the change still lands on the "1".
      if (s.rotation.mode === 'seconds') restartGrid();
      else {
        const { tempoAnchor } = useRotationStore.getState();
        if (tempoAnchor !== null) anchor = tempoAnchor;
        schedule(performance.now());
      }
    }
    preloadNext();
  });
  const offKits = useKitStore.subscribe((s, prev) => {
    if (s.currentKitId === prev.currentKitId || s.currentKitId === switchingTo) return;
    // The player picked a kit by hand: give it a full interval (seconds) and preload what follows it.
    if (useSettingsStore.getState().rotation.mode === 'seconds') restartGrid();
    preloadNext();
  });
  return () => {
    offSettings();
    offKits();
  };
}

/** Test helper. */
export function resetRotation(): void {
  stopRotation();
  taps = [];
  useRotationStore.setState({ tempoAnchor: null, interval: 0 });
}
