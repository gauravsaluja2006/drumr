import { z } from 'zod';
import { isVoice, type Voice } from './voices';

const pad = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  note: z.number().int().min(0).max(127),
  voice: z
    .string()
    .refine(isVoice, { message: 'unknown voice' })
    .transform((v) => v as Voice),
  label: z.string().max(24).optional(),
});

export const mappingSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(60),
    grid: z.object({ rows: z.number().int().min(1).max(8), cols: z.number().int().min(1).max(8) }),
    pads: z.array(pad),
    velocity: z.object({ exponent: z.number().min(1).max(4), floor: z.number().int().min(0).max(64) }),
    hihat: z.object({ cc: z.number().int().min(0).max(127), invert: z.boolean() }),
    /** 1-16, or null for omni. */
    channel: z.number().int().min(1).max(16).nullable(),
  })
  .superRefine((m, ctx) => {
    const notes = new Map<number, number>();
    const cells = new Set<string>();
    m.pads.forEach((p, i) => {
      if (p.row >= m.grid.rows || p.col >= m.grid.cols) {
        ctx.addIssue({
          code: 'custom',
          message: `pad ${i + 1} is outside the ${m.grid.rows}×${m.grid.cols} grid`,
          path: ['pads', i],
        });
      }
      const cell = `${p.row},${p.col}`;
      if (cells.has(cell))
        ctx.addIssue({
          code: 'custom',
          message: `two pads at row ${p.row}, column ${p.col}`,
          path: ['pads', i],
        });
      cells.add(cell);
      const other = notes.get(p.note);
      if (other !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `note ${p.note} is used by pads ${other + 1} and ${i + 1}`,
          path: ['pads', i, 'note'],
        });
      }
      notes.set(p.note, i);
    });
  });

export type Mapping = z.infer<typeof mappingSchema>;
export type PadMapping = Mapping['pads'][number];

/** Pad index on screen: row-major, row 0 at the top. */
export const padIndex = (m: Pick<Mapping, 'grid'>, p: Pick<PadMapping, 'row' | 'col'>) =>
  p.row * m.grid.cols + p.col;
