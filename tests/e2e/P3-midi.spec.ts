import { expect, test } from '@playwright/test';
import { lastHit, openApp, stats, startAudio, waitForKit } from './fixtures/app';
import { installFakeMidi } from './fixtures/fakeMidi';

const PAD = { id: 'maschine', name: 'Maschine Mikro MK3' };

test('US-03: fake device appears, is auto-selected, status shows its name', async ({ page }) => {
  await openApp(page);
  const status = page.getByTestId('midi-status');
  await expect(status).toHaveAttribute('data-status', 'no-device');
  await page.evaluate((d) => window.__fakeMidi!.addInput(d), PAD);
  await expect(status).toHaveText(`Connected · ${PAD.name}`);
  await page.evaluate(() => window.__fakeMidi!.removeInput('maschine'));
  await expect(status).toHaveAttribute('data-status', 'no-device');
});

test('US-04: fake note-on 25 velocity 100 triggers snare.center with curved velocity 115', async ({
  page,
}) => {
  await installFakeMidi(page, { devices: [PAD] });
  await openApp(page, { fakeMidi: false });
  await page.evaluate(() => window.__fakeMidi!.noteOn('maschine', 25, 100));
  expect((await stats(page)).lastTrigger).toMatchObject({ articulationId: 'snare.center', velocity: 115 });
  await expect(page.locator('[data-pad="13"]')).toHaveAttribute('data-hit-count', '1');
});

test('US-05: all 16 Maschine notes trigger the expected voices', async ({ page }) => {
  await installFakeMidi(page, { devices: [PAD] });
  await openApp(page, { fakeMidi: false });
  // [note, screen pad index, voice] — the PAD_ALIASES table in logic.js.
  const table: [number, number, string][] = [
    [24, 12, 'kick'],
    [25, 13, 'snare.center'],
    [26, 14, 'hihat.shank'],
    [27, 15, 'hihat.closed'],
    [28, 8, 'kick'],
    [29, 9, 'snare.rimshot'],
    [30, 10, 'snare.sidestick'],
    [31, 11, 'hihat.cc'],
    [32, 4, 'tom.high'],
    [33, 5, 'tom.highMid'],
    [34, 6, 'tom.lowMid'],
    [35, 7, 'tom.low'],
    [36, 0, 'crash.left'],
    [37, 1, 'crash.right'],
    [38, 2, 'ride.bow'],
    [39, 3, 'ride.bell'],
  ];
  for (const [note, padIndex, voice] of table) {
    await page.evaluate((n) => window.__fakeMidi!.noteOn('maschine', n, 90), note);
    expect(await lastHit(page), `note ${note}`).toMatchObject({ padIndex, voice, source: 'midi' });
  }
});

test('US-12: with requestMIDIAccess removed the banner shows and keyboard still plays', async ({ page }) => {
  await installFakeMidi(page, { mode: 'unsupported' });
  await page.goto('/');
  await waitForKit(page);
  await startAudio(page);
  await expect(page.getByRole('status').filter({ hasText: 'MIDI isn’t supported' })).toBeVisible();
  await expect(page.getByTestId('midi-status')).toHaveAttribute('data-status', 'unsupported');
  await page.keyboard.press('z');
  expect((await stats(page)).lastTrigger?.articulationId).toBe('kick');
});

test('US-12: with permission denied the banner shows Retry', async ({ page }) => {
  await installFakeMidi(page, { mode: 'deny' });
  await page.goto('/');
  await waitForKit(page);
  await startAudio(page);
  const banner = page.getByRole('status').filter({ hasText: 'blocked' });
  await expect(banner).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('L1: 200 fake note-ons have median event-to-schedule ≤ 2 ms and p95 ≤ 5 ms', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'latency budget is gated on Chromium (docs/06-METRICS.md)');
  await installFakeMidi(page, { devices: [PAD] });
  await openApp(page, { fakeMidi: false });
  await page.evaluate(async () => {
    for (let i = 0; i < 200; i++) {
      window.__fakeMidi!.noteOn('maschine', 24 + (i % 8), 100);
      if (i % 20 === 19) await new Promise((r) => setTimeout(r, 5));
    }
  });
  const { latency } = await stats(page);
  console.log(
    `L1 event-to-schedule: median ${latency.median.toFixed(3)} ms, p95 ${latency.p95.toFixed(3)} ms (${latency.samples} samples)`,
  );
  expect(latency.samples).toBeGreaterThanOrEqual(200);
  expect(latency.median).toBeLessThanOrEqual(2);
  expect(latency.p95).toBeLessThanOrEqual(5);
});

test('R1: 500 note-ons at 10 ms intervals all trigger', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'load test runs on Chromium');
  test.setTimeout(30_000);
  await installFakeMidi(page, { devices: [PAD] });
  await openApp(page, { fakeMidi: false });
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let i = 0;
        const id = setInterval(() => {
          window.__fakeMidi!.noteOn('maschine', 24 + (i % 8), 30 + (i % 97)); // notes 24-31: all playable in the test kit
          if (++i === 500) {
            clearInterval(id);
            done();
          }
        }, 10);
      }),
  );
  expect((await stats(page)).triggers).toBe(500);
});

test('with NI placeholder ports, hitting a pad on the real controller connects it and plays', async ({
  page,
}) => {
  await installFakeMidi(page, {
    devices: [
      { id: 'v1', name: 'Maschine Controller Virtual Input' },
      { id: 'v2', name: 'Maschine MK2 Virtual Input' },
      { id: 'z1', name: 'Traktor Kontrol Z1 Input' },
      { id: 'mikro', name: 'Maschine Mikro MK3' },
    ],
  });
  await openApp(page, { fakeMidi: false });
  const status = page.getByTestId('midi-status');
  await expect(status).toHaveText('Hit a pad to connect…');
  await status.click();
  const items = page.getByRole('menuitemradio');
  await expect(items.last()).toHaveText(/Virtual Input/); // placeholders listed last
  await page.keyboard.press('Escape');

  await page.evaluate(() => window.__fakeMidi!.noteOn('mikro', 24, 100));
  await expect(status).toHaveText('Connected · Maschine Mikro MK3');
  expect(await lastHit(page)).toMatchObject({ voice: 'kick', source: 'midi' });

  await page.reload(); // remembered from now on
  await waitForKit(page);
  await expect(page.getByTestId('midi-status')).toHaveText('Connected · Maschine Mikro MK3');
});
