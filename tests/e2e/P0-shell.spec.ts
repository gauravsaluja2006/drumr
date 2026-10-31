import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('P0: smoke — page loads and shows title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Drumr');
  await expect(page.getByRole('heading', { name: 'Drumr' })).toBeVisible();
  await expect(page.locator('button[data-pad]')).toHaveCount(16);
});

test('P0: axe — no serious violations on initial screen', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
