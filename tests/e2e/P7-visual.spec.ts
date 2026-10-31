import { expect, test, type Page } from '@playwright/test';
import { openApp } from './fixtures/app';

// Baselines exist per platform (darwin for local runs, linux for CI, generated in the Playwright
// Docker image: see docs/05-TESTING.md §7). Chromium only.
test.skip(({ browserName }) => browserName !== 'chromium', 'visual baselines are Chromium-only');

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250); // let the panel and pad transitions finish
}

const mask = (page: Page) => [page.locator('footer')]; // version and commit hash differ per build

test('P7: visual — idle grid matches baseline', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  await settle(page);
  await expect(page).toHaveScreenshot('idle-desktop.png', { mask: mask(page), maxDiffPixelRatio: 0.01 });
  await expect(page.getByRole('group', { name: 'Drum pads' })).toHaveScreenshot('idle-grid.png', {
    maxDiffPixelRatio: 0.01,
  });
});

test('P7: visual — phone layout matches baseline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await settle(page);
  await expect(page.getByRole('tab', { name: 'Kit & mixer' })).toBeVisible();
  await expect(page).toHaveScreenshot('phone.png', {
    mask: mask(page),
    maxDiffPixelRatio: 0.01,
    fullPage: true,
  });
});

test('visual — editor open and an unavailable pad', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openApp(page);
  await page.keyboard.press('m');
  await page.locator('[data-pad="5"]').click();
  await page.mouse.move(0, 0);
  await settle(page);
  await expect(page).toHaveScreenshot('editor-open.png', { mask: mask(page), maxDiffPixelRatio: 0.01 });
});
