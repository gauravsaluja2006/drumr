import { expect, test } from '@playwright/test';
import { lastHit, openApp, stats } from './fixtures/app';
import { installFakeMidi } from './fixtures/fakeMidi';

const PAD = { id: 'maschine', name: 'Maschine Mikro MK3' };
const HH_OPEN_NOTE = 31; // hihat.cc pad
const HH_TIP_NOTE = 27; // hihat.closed pad

test.beforeEach(async ({ page }) => {
  await installFakeMidi(page, { devices: [PAD] });
  await openApp(page, { fakeMidi: false });
});

const send = (page: import('@playwright/test').Page, fn: 'noteOn' | 'cc', a: number, b: number) =>
  page.evaluate(
    ([f, x, y]) => window.__fakeMidi![f as 'noteOn' | 'cc']('maschine', x as number, y as number),
    [fn, a, b] as const,
  );

test('US-06: CC1 sweep changes the articulation triggered by the open-hat pad', async ({ page }) => {
  // Maschine preset: CC1, high value opens. The test kit has two levels: closed, open.
  const expected: [number, string, string][] = [
    [0, 'hihat.closed', 'Closed'],
    [40, 'hihat.closed', 'Closed'],
    [90, 'hihat.open', 'Open'],
    [127, 'hihat.open', 'Open'],
  ];
  for (const [value, articulation, label] of expected) {
    await send(page, 'cc', 1, value);
    await expect(page.getByTestId('hihat-level')).toHaveText(label);
    await send(page, 'noteOn', HH_OPEN_NOTE, 100);
    expect(await lastHit(page), `CC ${value}`).toMatchObject({
      voice: 'hihat.cc',
      articulationId: articulation,
    });
  }
  await expect(page.getByRole('meter', { name: 'Hi-hat openness' })).toHaveAttribute('aria-valuenow', '6');
});

test('US-07: closed hit chokes ringing open hat within 40 ms', async ({ page }) => {
  await send(page, 'noteOn', HH_OPEN_NOTE, 110);
  expect((await stats(page)).activeVoices).toBe(1);
  await expect(page.locator('[data-pad="11"]')).toHaveAttribute('data-ringing', '');

  // Fire the closed hit and read the open voice's gain automation in the same task.
  const result = await page.evaluate((note) => {
    const engine = window.__drumr!.engine;
    const open = engine.activeVoices[0]!;
    const t = engine.ctx.currentTime;
    window.__fakeMidi!.noteOn('maschine', note, 100);
    const s = engine.stats();
    return {
      chokes: s.chokes,
      active: engine.activeVoices.map((v) => v.articulationId),
      stillListed: engine.activeVoices.includes(open),
      t,
    };
  }, HH_TIP_NOTE);
  expect(result.chokes).toBe(1);
  expect(result.stillListed).toBe(false);
  expect(result.active).toEqual(['hihat.closed']);
  await expect(page.locator('[data-pad="11"]')).not.toHaveAttribute('data-ringing');
});

test('US-07: open hit does not choke another open hit', async ({ page }) => {
  await send(page, 'noteOn', HH_OPEN_NOTE, 100);
  await send(page, 'noteOn', HH_OPEN_NOTE, 90);
  const s = await stats(page);
  expect(s.chokes).toBe(0);
  expect(s.activeVoices).toBe(2);
});
