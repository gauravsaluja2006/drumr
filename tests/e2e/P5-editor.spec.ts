import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { lastHit, openApp, startAudio, waitForKit } from './fixtures/app';
import { installFakeMidi } from './fixtures/fakeMidi';

const PAD = { id: 'maschine', name: 'Maschine Mikro MK3' };

test('US-09: learn flow end-to-end with fake MIDI, persists across reload', async ({ page }) => {
  await installFakeMidi(page, { devices: [PAD] });
  await openApp(page, { fakeMidi: false });
  await page.keyboard.press('m');
  const editor = page.getByTestId('mapping-editor');
  await expect(editor).toBeVisible();

  await page.locator('[data-pad="12"]').click(); // kick, bottom-left
  await expect(editor.getByRole('heading', { name: 'Pad 13' })).toBeVisible();
  await editor.getByRole('button', { name: 'Learn' }).click();
  await expect(page.locator('[data-pad="12"]')).toHaveAttribute('data-learning', 'true');
  await page.evaluate(() => window.__fakeMidi!.noteOn('maschine', 60, 100));
  await expect(editor.getByText('Learned note 60.')).toBeVisible();
  await expect(editor.getByLabel('MIDI note')).toHaveValue('60');
  await editor.getByLabel('Sound').selectOption('snare.rimshot');
  await editor.getByLabel('Label').fill('Rim');

  await page.reload();
  await waitForKit(page);
  await startAudio(page);
  await expect(page.getByRole('button', { name: /^Pad 13: Rim\s*, note 60$/ })).toBeVisible();
  await page.evaluate(() => window.__fakeMidi!.noteOn('maschine', 60, 100));
  expect(await lastHit(page)).toMatchObject({ padIndex: 12, voice: 'snare.rimshot' });
});

test('US-10: export then import round-trips the mapping', async ({ page }, info) => {
  await openApp(page);
  await page.getByRole('button', { name: /Edit layout/ }).click();
  const editor = page.getByTestId('mapping-editor');
  await page.locator('[data-pad="0"]').click();
  await editor.getByLabel('Sound').selectOption('cowbell');
  await editor.getByRole('button', { name: 'Save as…' }).click();
  await editor.getByLabel('Layout name').fill('Round trip');
  await editor.getByRole('button', { name: 'Save' }).click();

  const download = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Export JSON' }).click();
  const file = info.outputPath('mapping.json');
  await (await download).saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported).toMatchObject({ schemaVersion: 1, name: 'Round trip' });
  expect(exported.pads.find((p: { note: number }) => p.note === 36).voice).toBe('cowbell');

  // Fresh profile: clear storage, reload, import the file.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForKit(page);
  await startAudio(page);
  await expect(page.getByRole('button', { name: /Pad 1: Crash L/ })).toBeVisible();
  await page.getByRole('button', { name: /Edit layout/ }).click();
  await page.getByLabel('Import mapping file').setInputFiles(file);
  await expect(page.getByRole('button', { name: /Pad 1: Cowbell/ })).toBeVisible();
  await expect(page.getByLabel('Layout', { exact: true })).toHaveValue(/custom-/);
  const stored = await page.evaluate(() => window.__drumr!.mappingStore.getState().mapping);
  expect(stored).toEqual(exported);

  // A broken file is rejected and changes nothing.
  await page
    .getByLabel('Import mapping file')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"oops":1}') });
  await expect(page.getByRole('dialog', { name: 'Couldn’t import that mapping' })).toBeVisible();
  expect(await page.evaluate(() => window.__drumr!.mappingStore.getState().mapping)).toEqual(exported);
});

test('Q6: axe — editor open has no serious violations', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('m');
  await page.locator('[data-pad="5"]').click();
  await expect(page.getByTestId('mapping-editor')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('mapping-editor')).toBeHidden();
});
