/**
 * Renders the app icon (public/favicon.svg design) to PNGs with headless Chromium.
 * Usage: pnpm make:icons
 */
import { chromium } from '@playwright/test';
import { join } from 'node:path';

const out = join(process.cwd(), 'public/icons');

const icon = (size: number, inset: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${inset ? 0 : 8}" fill="#0b0c0f"/>
  <g transform="translate(${inset} ${inset}) scale(${(32 - 2 * inset) / 32})">
    <g fill="#1a1d23"><rect x="5" y="5" width="10" height="10" rx="2"/><rect x="17" y="17" width="10" height="10" rx="2"/><rect x="5" y="17" width="10" height="10" rx="2"/></g>
    <rect x="17" y="5" width="10" height="10" rx="2" fill="#ff7a1a"/>
  </g>
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
