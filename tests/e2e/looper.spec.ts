import { expect, test } from '@playwright/test';
import { lastHit, openApp, stats } from './fixtures/app';

test('looper: L arms, the first hit starts recording, L again closes and plays the loop back', async ({
  page,
}) => {
  await openApp(page);
  const looper = page.getByRole('region', { name: 'Looper' });
  await page.keyboard.press('l');
  await expect(looper.getByRole('button', { name: /Hit a pad to start/ })).toBeVisible();
  await page.waitForTimeout(300); // waiting does not count: the loop starts on the first hit

  await page.keyboard.press('z'); // kick: frame 0
  await expect(looper.getByRole('button', { name: /Close loop/ })).toBeVisible();
  await page.waitForTimeout(300);
  await page.keyboard.press('x'); // snare
  await page.waitForTimeout(300);
  await page.keyboard.press('l');
  await expect(looper.getByRole('button', { name: /Overdub/ })).toBeVisible();
  const info = await looper.getByTestId('loop-info').textContent();
  const seconds = Number(info!.split(' ')[0]);
  expect(seconds).toBeGreaterThan(0.5);
  expect(seconds).toBeLessThan(1.5);

  const before = (await stats(page)).triggers;
  await page.waitForTimeout(2_000); // at least one more full pass: 2+ hits per pass
  expect((await stats(page)).triggers - before).toBeGreaterThanOrEqual(3);
  expect((await lastHit(page))?.source).toBe('loop');

  await page.keyboard.press('Shift+L'); // stop
  await expect(looper.getByRole('button', { name: /Play loop/ })).toBeVisible();
  const stopped = (await stats(page)).triggers;
  await page.waitForTimeout(1_500);
  expect((await stats(page)).triggers).toBe(stopped);

  await looper.getByRole('button', { name: /Clear/ }).click();
  await expect(looper.getByRole('button', { name: /Record loop/ })).toBeVisible();
});
