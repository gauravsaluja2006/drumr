import { expect, test } from '@playwright/test';
import { openApp, openSettings, startAudio, waitForKit } from './fixtures/app';

const fx = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const e = window.__drumr!.engine.effects;
    return {
      created: [...e.created].sort(),
      room: e.settings.room.on,
      hall: e.settings.hall.on,
      echo: e.settings.echo.on,
    };
  });

test('effects: every kit starts with room and hall; toggles are per kit, build real Web Audio nodes, and persist', async ({
  page,
}) => {
  await openApp(page);
  const sound = page.getByRole('region', { name: 'Sound' });
  await expect(sound.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-pressed', 'true');
  await expect(sound.getByRole('button', { name: 'Hall' })).toHaveAttribute('aria-pressed', 'true');
  expect(await fx(page)).toEqual({ created: ['hall', 'room'], room: true, hall: true, echo: false });

  await sound.getByRole('button', { name: 'Echo' }).click();
  expect(await fx(page)).toMatchObject({ created: ['echo', 'hall', 'room'], echo: true });
  // Playing through the effects still triggers normally.
  expect(await page.evaluate(() => !!window.__drumr!.engine.trigger('snare.center', 100))).toBe(true);

  await page.reload();
  await waitForKit(page);
  await startAudio(page);
  await expect(
    page.getByRole('region', { name: 'Sound' }).getByRole('button', { name: 'Echo' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Another kit keeps its own (recommended) sound.
  await page.getByRole('list', { name: 'Drum kits' }).getByRole('button', { name: 'Test Kit B' }).click();
  await waitForKit(page, 'test-kit-b');
  expect(await fx(page)).toMatchObject({ room: true, hall: true, echo: false });
});

test('tune and length per drum reach the engine for the current kit', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Tune & effects…' }).click();
  const tune = page.getByRole('slider', { name: 'Snare tune' });
  await tune.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  const length = page.getByRole('slider', { name: 'Snare length' });
  await length.focus();
  await page.keyboard.press('Home');
  const tone = () => page.evaluate(() => window.__drumr!.engine.groupTone('snare'));
  await expect.poll(tone).toEqual({ tune: 2, decay: 0.1 });
  const rate = await page.evaluate(() => {
    const v = window.__drumr!.engine.trigger('snare.center', 127);
    return (v!.source as unknown as AudioBufferSourceNode).playbackRate.value;
  });
  expect(rate).toBeGreaterThan(1.1); // two semitones up (±8 cents natural variation)
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await page.getByRole('list', { name: 'Drum kits' }).getByRole('button', { name: 'Test Kit B' }).click();
  await waitForKit(page, 'test-kit-b');
  await expect.poll(tone).toEqual({ tune: 0, decay: 1 });
  await openSettings(page, 'Sound');
  await expect(page.getByRole('slider', { name: 'Snare tune' })).toHaveAttribute('aria-valuetext', '0 st');
});
