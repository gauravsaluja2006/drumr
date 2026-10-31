import { z } from 'zod';
import { GROUPS } from '../../src/kits/schema';

const source = z.union([
  z.object({ glob: z.string(), gainDb: z.number().default(0) }).transform((s) => [s]),
  z
    .object({ mix: z.array(z.object({ glob: z.string(), gainDb: z.number().default(0) })).min(1) })
    .transform((s) => s.mix),
]);

export const recipeArticulationSchema = z
  .object({
    id: z.string().min(1),
    group: z.enum(GROUPS),
    chokeGroup: z.string().optional(),
    chokedBy: z.array(z.string()).optional(),
    gainDb: z.number().default(0),
    /** Overrides budget.maxVelocityLayers for this articulation. */
    maxVelocityLayers: z.number().int().positive().optional(),
    /** Glob relative to source.root; {layer} and {rr} capture integers. A string is shorthand for one source. */
    glob: z.string().optional(),
    mix: z.array(z.object({ glob: z.string(), gainDb: z.number().default(0) })).optional(),
    /** Explicit velocity ranges, one per kept layer, ascending. */
    ranges: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
    /** DrumGizmo instrument name (requires recipe.drumgizmo). Replaces glob/mix. */
    instrument: z.string().optional(),
  })
  .transform((a, ctx) => {
    if (a.instrument) return { ...a, sources: [] as { glob: string; gainDb: number }[] };
    const parsed = source.safeParse(a.mix ? { mix: a.mix } : { glob: a.glob });
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: `${a.id}: needs "glob" or "mix"` });
      return z.NEVER;
    }
    return { ...a, sources: parsed.data };
  });

export const recipeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  order: z.number().int().default(100),
  name: z.string(),
  description: z.string(),
  license: z.object({ name: z.string(), url: z.url() }),
  attribution: z.object({ author: z.string(), url: z.url() }),
  /** Full licence text to ship as LICENSE.txt (required for CC-BY-SA kits). */
  licenseText: z.string().optional(),
  source: z.object({ libraryId: z.string(), root: z.string().default('') }),
  /** DrumGizmo kit XML relative to source.root; articulations then name `instrument`s. */
  drumgizmo: z
    .object({
      kit: z.string(),
      /** Per-microphone gain multipliers by channel name (default 1). */
      micGains: z.record(z.string(), z.number()).default({}),
    })
    .optional(),
  /**
   * Local-only kit: built into public/kits-local/ (gitignored) and listed in its own index, for
   * trying large libraries without committing them.
   */
  local: z.boolean().default(false),
  output: z
    .object({
      sampleRate: z.number().int().default(44100),
      bitDepth: z.literal(16).default(16),
      channels: z.union([z.literal(1), z.literal(2)]).default(2),
    })
    .prefault({}),
  budget: z
    .object({
      maxBytes: z.number().int().default(30_000_000),
      maxRoundRobins: z.number().int().positive().default(2),
      maxVelocityLayers: z.number().int().positive().default(4),
    })
    .prefault({}),
  trim: z
    .object({
      startThresholdDb: z.number().default(-50),
      endThresholdDb: z.number().default(-60),
      maxSeconds: z.record(z.string(), z.number()).default({ default: 2.5, cymbals: 5 }),
      fadeOutMs: z.number().default(30),
    })
    .prefault({}),
  normalize: z
    .object({
      reference: z.string().default('snare.center'),
      targetPeakDbfs: z.number().default(-6),
    })
    .prefault({}),
  articulations: z.array(recipeArticulationSchema).min(1),
  hihat: z
    .object({
      openness: z.array(z.string()).min(2),
      pedal: z.string().optional(),
      splash: z.string().optional(),
    })
    .optional(),
});

export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeArticulation = Recipe['articulations'][number];
