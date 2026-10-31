import { expect, test } from '@playwright/test';
import { openApp, startAudio, waitForKit } from './fixtures/app';

test('US-11: moving the hi-hat slider to -12 dB changes hi-hat voice gain and persists', async ({ page }) => {
  await openApp(page);
  const slider = page.getByRole('slider', { name: 'Hi-hat' });
  await slider.focus();
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await expect(slider).toHaveAttribute('aria-valuetext', '−12.0 dB');

  const gains = () => page.evaluate(() => ({ ...window.__drumr!.engine.gainDb }));
  expect(await gains()).toMatchObject({ hihat: -12, kick: 0, snare: 0, master: 0 });
  // The hi-hat voice is routed through the hi-hat group node.
  const routedThroughGroup = await page.evaluate(() => {
    const engine = window.__drumr!.engine;
    engine.trigger('hihat.closed', 100);
    return engine.activeVoices.at(-1)!.group;
  });
  expect(routedThroughGroup).toBe('hihat');

  await page.reload();
  await waitForKit(page);
  await startAudio(page);
  await expect(page.getByRole('slider', { name: 'Hi-hat' })).toHaveAttribute('aria-valuetext', '−12.0 dB');
  expect(await gains()).toMatchObject({ hihat: -12 });

  // Per kit: switching kits restores that kit's own mix (default 0 dB).
  await page.getByRole('button', { name: /Kit.*Test Kit/ }).click();
  await page.getByRole('option', { name: /Test Kit B/ }).click();
  await waitForKit(page, 'test-kit-b');
  expect(await gains()).toMatchObject({ hihat: 0 });
});
