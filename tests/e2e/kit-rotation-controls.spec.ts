import { expect, test } from '@playwright/test';
import { lastHit, openApp, startAudio, waitForKit, openSettings } from './fixtures/app';
import { installFakeMidi } from './fixtures/fakeMidi';

const kitId = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__drumr!.kitStore.getState().currentKitId);

test('kit list loads a kit on click and rotation cycles the ticked kits on a timer', async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  const kits = page.getByRole('list', { name: 'Drum kits' });
  await kits.getByRole('button', { name: 'Test Kit B' }).click();
  await waitForKit(page, 'test-kit-b');
  await expect(kits.getByRole('button', { name: 'Test Kit B' })).toHaveAttribute('aria-current', 'true');

  // Checkboxes only appear while rotating.
  await expect(kits.getByRole('checkbox')).toHaveCount(0);
  await page.getByLabel('every').selectOption('s10');
  await page.getByRole('button', { name: 'Rotate kits' }).click();
  await expect(page.getByRole('button', { name: 'Rotating' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Rotate through Test Kit', { exact: true }).check();

  await page.clock.runFor(10_000);
  await waitForKit(page, 'test-kit');
  await page.clock.runFor(10_000); // only the playing kit is ticked: stays put, keeps rotating
  expect(await kitId(page)).toBe('test-kit');
  // Tick a second kit: rotation now alternates between the two.
  await page.getByLabel('Rotate through Test Kit B').check();
  await page.clock.runFor(10_000);
  await waitForKit(page, 'test-kit-b');
  await page.clock.runFor(10_000);
  await waitForKit(page, 'test-kit');

  await page.getByRole('button', { name: 'Rotating' }).click();
  await expect(kits.getByRole('checkbox')).toHaveCount(0);
  await page.clock.runFor(30_000);
  expect(await kitId(page)).toBe('test-kit');
  // Ticks persist.
  await page.reload();
  await waitForKit(page);
  await startAudio(page);
  await page.getByRole('button', { name: 'Rotate kits' }).click();
  await expect(page.getByLabel('Rotate through Test Kit B')).toBeChecked();
});

test('MIDI learn: a controller button switches kits, a knob sets master volume, program change picks a kit', async ({
  page,
}) => {
  await installFakeMidi(page, { devices: [{ id: 'mikro', name: 'Maschine Mikro MK3' }] });
  await openApp(page, { fakeMidi: false });
  await page.evaluate(() => window.__fakeMidi!.noteOn('mikro', 24, 100)); // connect by playing a pad
  await expect.poll(async () => (await lastHit(page))?.voice).toBe('kick');

  await openSettings(page, 'Controller');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('button', { name: 'Learn Next kit' }).click();
  await expect(dialog.getByTestId('binding-kit.next')).toHaveText('Move it…');
  await page.evaluate(() => window.__fakeMidi!.cc('mikro', 102, 127));
  await expect(dialog.getByTestId('binding-kit.next')).toHaveText('CC 102');

  await dialog.getByRole('button', { name: 'Learn Master volume' }).click();
  await page.evaluate(() => window.__fakeMidi!.cc('mikro', 70, 0));
  await expect(dialog.getByTestId('binding-mix.master')).toHaveText('CC 70');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();

  await page.evaluate(() => window.__fakeMidi!.cc('mikro', 102, 127));
  await waitForKit(page, 'test-kit-b');
  await page.evaluate(() => window.__fakeMidi!.cc('mikro', 70, 127));
  await expect(page.getByRole('slider', { name: 'Master' })).toHaveAttribute('aria-valuetext', '+6.0 dB');

  await page.evaluate(() => window.__fakeMidi!.send('mikro', [0xc0, 0])); // program 1 → first kit
  await waitForKit(page, 'test-kit');

  // Assignments persist across reloads.
  await page.reload();
  await waitForKit(page);
  await startAudio(page);
  await openSettings(page, 'Controller');
  await expect(page.getByTestId('binding-kit.next')).toHaveText('CC 102');
});
