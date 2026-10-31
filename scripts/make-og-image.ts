/**
 * Captures public/og-image.png (1200×630) from a running production preview with pads mid-hit.
 * Usage: pnpm build && pnpm preview --port 4186 & then: pnpm make:og-image
 *
 * Browser-side code is passed as strings: tsx (esbuild keepNames) would otherwise inject a
 * `__name` helper that does not exist in the page.
 */
import { chromium } from '@playwright/test';
import { join } from 'node:path';

const url = process.env.OG_URL ?? 'http://localhost:4186/';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

await page.addInitScript(`{
  const port = { id: 'm', name: 'Maschine Mikro MK3', manufacturer: 'NI', type: 'input', state: 'connected', onmidimessage: null };
  window.__port = port;
  Object.defineProperty(Navigator.prototype, 'requestMIDIAccess', {
    configurable: true,
    value: async () => ({ inputs: new Map([['m', port]]), outputs: new Map(), onstatechange: null }),
  });
}`);

await page.goto(url);
await page.waitForFunction(
  `!document.querySelector('[data-pad="12"]')?.hasAttribute('disabled')`,
  undefined,
  {
    timeout: 30_000,
  },
);
await page.evaluate('document.fonts.ready');
await page.addStyleTag({
  content:
    '.pad[data-hit], .pad[data-hit]::after, .pad[data-hit]::before { animation-play-state: paused !important; } footer { display: none }',
});
await page.evaluate(`{
  for (const b of [[0xb0, 1, 70], [0x90, 24, 120], [0x90, 31, 90], [0x90, 33, 60]]) window.__port.onmidimessage({ data: new Uint8Array(b) });
}`);
await page.waitForTimeout(150);
await page.screenshot({ path: join(process.cwd(), 'public/og-image.png') });
await browser.close();
console.log('wrote public/og-image.png');
