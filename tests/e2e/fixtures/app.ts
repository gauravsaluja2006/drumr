import { expect, type Page } from '@playwright/test';
import type { EngineStats } from '../../../src/engine/AudioEngine';

/** Dismiss the "tap to start audio" overlay if the browser started audio suspended. */
export async function startAudio(page: Page): Promise<void> {
  const overlay = page.getByTestId('audio-overlay');
  if (await overlay.isVisible()) {
    await overlay.click();
    await expect(overlay).toBeHidden();
  }
}

export function stats(page: Page): Promise<EngineStats> {
  return page.evaluate(() => window.__drumr!.engine.stats());
}

export async function waitForKit(page: Page, kitId?: string): Promise<void> {
  await page.waitForFunction((id) => {
    const s = window.__drumr?.kitStore.getState();
    return s?.status === 'ready' && (!id || s.currentKitId === id);
  }, kitId);
}

/** Open the app with audio running and the default kit ready. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await waitForKit(page);
  await startAudio(page);
}
