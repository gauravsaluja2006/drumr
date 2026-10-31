import { z } from 'zod';

export const GROUPS = ['kick', 'snare', 'hihat', 'toms', 'cymbals', 'perc'] as const;
export type Group = (typeof GROUPS)[number];

const samplePath = z
  .string()
  .regex(
    /^(?!\/)(?![a-z]+:)(?!.*(?:^|\/)\.\.(?:\/|$)).+\.(flac|wav)$/i,
    'sample path must be relative and end in .flac or .wav',
  );

const layer = z.object({
  lovel: z.number().int().min(1).max(127),
  hivel: z.number().int().min(1).max(127),
  samples: z.array(samplePath).min(1),
});

const articulation = z.object({
  id: z.string().min(1),
  group: z.enum(GROUPS),
  chokeGroup: z.string().optional(),
  chokedBy: z.array(z.string()).optional(),
  gainDb: z.number().default(0),
  layers: z.array(layer).min(1),
});

export const kitManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    description: z.string(),
    license: z.object({ name: z.string(), url: z.url() }),
    attribution: z.object({ author: z.string(), url: z.url() }),
    sampleRate: z.number().int().positive(),
    format: z.enum(['flac', 'wav']),
    totalBytes: z.number().int().nonnegative(),
    groups: z.array(z.enum(GROUPS)),
    articulations: z.array(articulation).min(1),
    hihat: z
      .object({
        openness: z.array(z.string()).min(2),
        pedal: z.string().optional(),
        splash: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((kit, ctx) => {
    const ids = new Set<string>();
    kit.articulations.forEach((a, ai) => {
      if (ids.has(a.id))
        ctx.addIssue({
          code: 'custom',
          message: `duplicate articulation id "${a.id}"`,
          path: ['articulations', ai, 'id'],
        });
      ids.add(a.id);

      const sorted = [...a.layers].sort((x, y) => x.lovel - y.lovel);
      let expected = 1;
      for (const l of sorted) {
        if (l.lovel > l.hivel) {
          ctx.addIssue({
            code: 'custom',
            message: `${a.id}: layer lovel ${l.lovel} > hivel ${l.hivel}`,
            path: ['articulations', ai, 'layers'],
          });
        } else if (l.lovel < expected) {
          ctx.addIssue({
            code: 'custom',
            message: `${a.id}: overlapping layers at velocity ${l.lovel}`,
            path: ['articulations', ai, 'layers'],
          });
        } else if (l.lovel > expected) {
          ctx.addIssue({
            code: 'custom',
            message: `${a.id}: gap in layers at velocity ${expected}`,
            path: ['articulations', ai, 'layers'],
          });
        }
        expected = Math.max(expected, l.hivel + 1);
      }
      if (expected <= 127) {
        ctx.addIssue({
          code: 'custom',
          message: `${a.id}: gap in layers at velocity ${expected}`,
          path: ['articulations', ai, 'layers'],
        });
      }
    });

    kit.articulations.forEach((a, ai) => {
      a.chokedBy?.forEach((c, ci) => {
        if (!ids.has(c))
          ctx.addIssue({
            code: 'custom',
            message: `${a.id}: unknown chokedBy "${c}"`,
            path: ['articulations', ai, 'chokedBy', ci],
          });
      });
    });

    const hh = kit.hihat;
    if (hh) {
      [...hh.openness, hh.pedal, hh.splash].forEach((id) => {
        if (id !== undefined && !ids.has(id))
          ctx.addIssue({
            code: 'custom',
            message: `hihat references unknown articulation "${id}"`,
            path: ['hihat'],
          });
      });
    }
  });

export type KitManifest = z.infer<typeof kitManifestSchema>;
export type Articulation = KitManifest['articulations'][number];

export const kitIndexSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    totalBytes: z.number().int().nonnegative(),
    thumbnail: z.string().optional(),
  }),
);
export type KitIndex = z.infer<typeof kitIndexSchema>;

/** Human-readable first issue, e.g. for a toast. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'invalid manifest';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}
