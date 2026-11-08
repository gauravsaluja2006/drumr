import { expect, test } from '@playwright/test';
import { openApp, startAudio, waitForKit } from './fixtures/app';

test('effects: reverb and echo switch on per kit, build real Web Audio nodes, and persist', async ({
  page,
}) => {
  await openApp(page);
  const panel = page.getByRole('region', { name: 'Effects' });
  await panel.getByRole('button', { name: 'Room' }).click();
  await panel.getByRole('button', { name: 'Echo' }).click();
  await expect(panel.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-pressed', 'true');

  const fx = () =>
    page.evaluate(() => {
      const e = window.__drumr!.engine.effects;
      return { created: [...e.created], room: e.settings.room.on, echo: e.settings.echo.on };
    });
  expect(await fx()).toEqual({ created: ['room', 'echo'], room: true, echo: true });
  // Playing through the effects still triggers normally.
  expect(await page.evaluate(() => !!window.__drumr!.engine.trigger('snare.center', 100))).toBe(true);

  await page.reload();
  await waitForKit(page);
  await startAudio(page);
  await expect(
    page.getByRole('region', { name: 'Effects' }).getByRole('button', { name: 'Room' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect((await fx()).room).toBe(true);

  // Another kit keeps its own (default: off) effects.
  await page.getByRole('list', { name: 'Drum kits' }).getByRole('button', { name: 'Test Kit B' }).click();
  await waitForKit(page, 'test-kit-b');
  expect(await fx()).toMatchObject({ room: false, echo: false });
});
