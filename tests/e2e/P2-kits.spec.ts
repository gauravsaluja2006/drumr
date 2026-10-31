import { expect, test } from '@playwright/test';
import { openApp, stats, waitForKit } from './fixtures/app';

test('US-08: switching kit while playing completes without errors and old voices keep ringing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);

  await page.keyboard.press('4'); // HH Open: a 2 s sample that should keep ringing through the switch
  const before = await stats(page);
  expect(before.lastTrigger?.articulationId).toBe('hihat.open');
  expect(before.activeVoices).toBe(1);

  await page.getByRole('button', { name: /Kit.*Test Kit/ }).click();
  await page.getByRole('option', { name: /Test Kit B/ }).click();
  await waitForKit(page, 'test-kit-b');

  const s = await stats(page);
  expect(s.kitId).toBe('test-kit-b');
  expect(s.activeVoices).toBeGreaterThanOrEqual(1); // the open hat from the old kit
  expect(s.steals + s.chokes).toBe(0);
  await expect(page.getByTestId('kit-name')).toHaveText('Test Kit B');

  // Kit B has no hi-hat: those pads are marked unavailable; kick still plays from kit B.
  await expect(page.locator('[data-pad="2"]')).toHaveAttribute('data-unavailable', 'true');
  await page.keyboard.press('1');
  expect((await stats(page)).lastTrigger?.articulationId).toBe('kick');
  expect(errors).toEqual([]);
});

test('US-13: About panel lists every kit with license and link', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /About/ }).click();
  const dialog = page.getByRole('dialog', { name: 'About Drumr' });
  await expect(dialog).toBeVisible();
  for (const kit of ['test-kit', 'test-kit-b']) {
    const row = dialog.locator(`tr[data-kit="${kit}"]`);
    await expect(row.getByRole('link', { name: 'CC0-1.0' })).toHaveAttribute('href', /creativecommons\.org/);
    await expect(row.getByRole('link', { name: 'Drumr (generated)' })).toHaveAttribute('href', /github\.com/);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('S4: time to first playable ≤ 3 s at 50 Mbps', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'network throttling uses the Chrome DevTools Protocol');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 20,
    downloadThroughput: (50 * 1024 * 1024) / 8,
    uploadThroughput: (10 * 1024 * 1024) / 8,
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__drumr?.engine.stats().ready, undefined, { polling: 'raf' });
  const ms = await page.evaluate(() => performance.now());
  console.log(`S4 time to first playable: ${ms.toFixed(0)} ms`);
  expect(ms).toBeLessThanOrEqual(3000);
});
