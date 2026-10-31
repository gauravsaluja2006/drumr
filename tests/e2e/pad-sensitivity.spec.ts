import { expect, test } from '@playwright/test';
import { lastHit, openApp } from './fixtures/app';
import { installFakeMidi } from './fixtures/fakeMidi';

test('lowering "Hardest hit" makes the same soft pad hit louder', async ({ page }) => {
  await installFakeMidi(page, { devices: [{ id: 'mikro', name: 'Maschine Mikro MK3' }] });
  await openApp(page, { fakeMidi: false });
  const soft = async () => {
    await page.evaluate(() => window.__fakeMidi!.noteOn('mikro', 24, 40));
    return (await lastHit(page))!.velocity;
  };
  const before = await soft();
  const hardest = page.getByRole('slider', { name: 'Hardest hit' });
  await hardest.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press('PageDown'); // 127 → 79
  await expect(hardest).toHaveAttribute('aria-valuetext', 'velocity 79');
  const after = await soft();
  expect(after).toBeGreaterThan(before);
  // Persists with the layout across reloads.
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Hardest hit' })).toHaveAttribute(
    'aria-valuetext',
    'velocity 79',
  );
});
