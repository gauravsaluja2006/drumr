import { mappingSchema, type Mapping } from '../schema';
import maschine from './maschine-logic.json';
import gm from './generic-gm.json';

export interface Preset {
  id: string;
  mapping: Mapping;
}

/** Built-in presets, validated at module load so a broken preset fails tests immediately. */
export const BUILTIN_PRESETS: readonly Preset[] = [
  { id: 'maschine-logic', mapping: mappingSchema.parse(maschine) },
  { id: 'generic-gm', mapping: mappingSchema.parse(gm) },
];

export const DEFAULT_PRESET_ID = 'maschine-logic';
