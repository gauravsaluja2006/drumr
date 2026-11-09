/**
 * Renders the app icon (public/favicon.svg design) to PNGs with headless Chromium.
 * Usage: pnpm make:icons
 */
import { chromium } from '@playwright/test';
import { join } from 'node:path';

const out = join(process.cwd(), 'public/icons');

const MARK = `<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb86b"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><g fill="#2b303a"><rect x="6" y="17" width="9" height="9" rx="2.2"/><rect x="17" y="17" width="9" height="9" rx="2.2"/><rect x="17" y="6" width="9" height="9" rx="2.2"/></g><rect x="6" y="6" width="9" height="9" rx="2.2" fill="#ff7a1a" opacity=".55" filter="url(#g)"/><rect x="6" y="6" width="9" height="9" rx="2.2" fill="url(#l)"/><rect x="3.75" y="3.75" width="13.5" height="13.5" rx="4" fill="none" stroke="#ff7a1a" stroke-opacity=".45"/>`;

/** public/favicon.svg's mark; `inset` pads it for maskable icons (full-bleed background). */
const icon = (size: number, inset: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${inset ? 0 : 8}" fill="#1a1d23"/>
  <g transform="translate(${inset} ${inset}) scale(${(32 - 2 * inset) / 32})">${MARK}</g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, inset] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 4], // safe zone padding for maskable icons
  ['apple-touch-icon.png', 180, 0],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#0b0c0f">${icon(size, inset)}</body></html>`);
  await page.locator('svg').screenshot({ path: join(out, name), omitBackground: false });
  console.log('wrote', name);
}
await browser.close();
