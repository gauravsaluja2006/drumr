import { describe, expect, test } from 'vitest';
import { firstIssue, kitIndexSchema, kitManifestSchema } from '@/kits/schema';
import { testManifest } from '../fakes/kits';

const messages = (input: unknown) => {
  const r = kitManifestSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('kit schema', () => {
  test('accepts the test manifest', () => {
    expect(kitManifestSchema.safeParse(testManifest()).success).toBe(true);
  });

  test('P1: kit schema rejects overlapping layers, gaps, unknown chokedBy, non-relative paths', () => {
    const base = testManifest();
    const kick = base.articulations[0]!;

    const overlap = {
      ...base,
      articulations: [
        {
          ...kick,
          layers: [
            { lovel: 1, hivel: 70, samples: ['a.wav'] },
            { lovel: 64, hivel: 127, samples: ['b.wav'] },
          ],
        },
      ],
    };
    expect(messages(overlap).join()).toMatch(/overlapping layers/);

    const gap = {
      ...base,
      articulations: [
        {
          ...kick,
          layers: [
            { lovel: 1, hivel: 50, samples: ['a.wav'] },
            { lovel: 60, hivel: 127, samples: ['b.wav'] },
          ],
        },
      ],
    };
    expect(messages(gap).join()).toMatch(/gap in layers at velocity 51/);

    const short = {
      ...base,
      articulations: [{ ...kick, layers: [{ lovel: 1, hivel: 100, samples: ['a.wav'] }] }],
    };
    expect(messages(short).join()).toMatch(/gap in layers at velocity 101/);

    const unknownChoke = { ...base, articulations: [{ ...kick, chokedBy: ['nope'] }] };
    expect(messages(unknownChoke).join()).toMatch(/unknown chokedBy "nope"/);

    for (const bad of ['/abs.wav', 'https://x.com/a.wav', '../up.wav', 'a/../../b.wav', 'a.mp3']) {
      const m = { ...base, articulations: [{ ...kick, layers: [{ lovel: 1, hivel: 127, samples: [bad] }] }] };
      expect(messages(m).join(), bad).toMatch(/relative/);
    }
  });

  test('rejects inverted layers, duplicate ids and unknown hihat references', () => {
    const base = testManifest();
    const kick = base.articulations[0]!;
    expect(
      messages({
        ...base,
        articulations: [{ ...kick, layers: [{ lovel: 90, hivel: 10, samples: ['a.wav'] }] }],
      }).join(),
    ).toMatch(/lovel 90 > hivel 10/);
    expect(messages({ ...base, articulations: [kick, kick] }).join()).toMatch(/duplicate articulation/);
    expect(messages({ ...base, hihat: { openness: ['hihat.closed', 'hihat.ghost'] } }).join()).toMatch(
      /hihat.ghost/,
    );
  });

  test('firstIssue formats path and message', () => {
    const r = kitManifestSchema.safeParse({ ...testManifest(), id: 'Bad Id' });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssue(r.error)).toMatch(/^id: /);
  });

  test('kit index schema', () => {
    expect(kitIndexSchema.safeParse([{ id: 'a', name: 'A', description: '', totalBytes: 1 }]).success).toBe(
      true,
    );
    expect(kitIndexSchema.safeParse([{ id: 'a' }]).success).toBe(false);
  });
});
