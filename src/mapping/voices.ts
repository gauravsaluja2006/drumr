/** Canonical logical voices (docs/02-ARCHITECTURE.md §3.1). Mappings reference these, never kit files. */
export const VOICE_FAMILIES = {
  Kick: ['kick'],
  Snare: ['snare.center', 'snare.edge', 'snare.rimshot', 'snare.sidestick'],
  Toms: ['tom.high', 'tom.highMid', 'tom.lowMid', 'tom.low'],
  'Hi-hat': [
    'hihat.cc',
    'hihat.closed',
    'hihat.half',
    'hihat.threeQuarter',
    'hihat.open',
    'hihat.pedal',
    'hihat.splash',
    'hihat.shank',
  ],
  Ride: ['ride.bow', 'ride.bell', 'ride.edge'],
  Crash: ['crash.left', 'crash.right', 'crash.leftChoke', 'crash.rightChoke', 'china', 'splash'],
  Percussion: ['clap', 'tambourine', 'shaker', 'cowbell', 'stick'],
} as const;

export type Voice = (typeof VOICE_FAMILIES)[keyof typeof VOICE_FAMILIES][number];

export const VOICES: readonly Voice[] = Object.values(VOICE_FAMILIES).flat();
const VOICE_SET = new Set<string>(VOICES);

export const isVoice = (v: string): v is Voice => VOICE_SET.has(v);

const LABELS: Record<Voice, string> = {
  kick: 'Kick',
  'snare.center': 'Snare',
  'snare.edge': 'Snare Edge',
  'snare.rimshot': 'Rimshot',
  'snare.sidestick': 'Side Stick',
  'tom.high': 'High Tom',
  'tom.highMid': 'High-Mid Tom',
  'tom.lowMid': 'Low-Mid Tom',
  'tom.low': 'Low Tom',
  'hihat.cc': 'HH Open (CC)',
  'hihat.closed': 'HH Closed',
  'hihat.half': 'HH Half',
  'hihat.threeQuarter': 'HH ¾ Open',
  'hihat.open': 'HH Open',
  'hihat.pedal': 'HH Pedal',
  'hihat.splash': 'HH Splash',
  'hihat.shank': 'HH Shank',
  'ride.bow': 'Ride',
  'ride.bell': 'Ride Bell',
  'ride.edge': 'Ride Edge',
  'crash.left': 'Crash L',
  'crash.right': 'Crash R',
  'crash.leftChoke': 'Crash L Choke',
  'crash.rightChoke': 'Crash R Choke',
  china: 'China',
  splash: 'Splash',
  clap: 'Clap',
  tambourine: 'Tambourine',
  shaker: 'Shaker',
  cowbell: 'Cowbell',
  stick: 'Stick',
};

export const voiceLabel = (v: Voice): string => LABELS[v];
