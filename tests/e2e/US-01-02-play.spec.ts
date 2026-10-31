import { expect, test } from '@playwright/test';
import { lastHit, openApp, stats, startAudio, waitForKit } from './fixtures/app';
import { installFakeMidi } from './fixtures/fakeMidi';

// Default layout is the Maschine preset: kick is the bottom-left pad (index 12, key "z").
const KICK_PAD = '[data-pad="12"]';

test('US-01: default kit loads with progress and first pad is playable', async ({ page }) => {
  const progress: number[] = [];
  await page.exposeFunction('__recordProgress', (p: number) => progress.push(p));
  await page.addInitScript(() => {
    const id = setInterval(() => {
      const store = window.__drumr?.kitStore;
      if (!store) return;
      clearInterval(id);
      const rec = (window as unknown as { __recordProgress: (n: number) => void }).__recordProgress;
      const s0 = store.getState();
      rec(s0.progress.total ? s0.progress.loaded / s0.progress.total : 0);
      store.subscribe((s) => rec(s.progress.total ? s.progress.loaded / s.progress.total : 0));
    }, 1);
  });
  await installFakeMidi(page);
  await page.goto('/');
  await waitForKit(page);
  await expect(page.getByTestId('kit-name')).toHaveText('Test Kit');
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  expect(progress.at(-1)).toBe(1);
  for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]!);

  await startAudio(page);
  const pad = page.locator(KICK_PAD);
  await expect(pad).toBeEnabled();
  await pad.click();
  expect((await stats(page)).lastTrigger?.articulationId).toBe('kick');
});

test('US-02: clicking pad 1 triggers a sound and flashes the pad', async ({ page }) => {
  await openApp(page);
  const pad = page.locator(KICK_PAD);
  await pad.click();
  const s = await stats(page);
  expect(s.triggers).toBe(1);
  expect(s.lastTrigger).toMatchObject({ articulationId: 'kick' });
  // Click at the centre: velocity ≈ 60 + 67 × 0.5
  expect(s.lastTrigger!.velocity).toBeGreaterThanOrEqual(90);
  expect(s.lastTrigger!.velocity).toBeLessThanOrEqual(98);
  await expect(pad).toHaveAttribute('data-hit-count', '1');
});

test('US-02: pressing key "q" triggers pad 4', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('q');
  expect(await lastHit(page)).toMatchObject({ padIndex: 4, voice: 'tom.high', velocity: 100, source: 'ui' });
  await expect(page.locator('[data-pad="4"]')).toHaveAttribute('data-hit-count', '1');
  await page.keyboard.press('x'); // bottom row, second pad: snare
  expect((await stats(page)).lastTrigger).toMatchObject({ articulationId: 'snare.center', velocity: 100 });
});
