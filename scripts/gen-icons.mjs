// Renders the PWA icons from an inline SVG using the locally available Playwright Chromium.
// Usage: node scripts/gen-icons.mjs   (needs a global `playwright` install)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(join(globalRoot, 'playwright'));

const art = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#3a1670"/><stop offset=".55" stop-color="#15123a"/><stop offset="1" stop-color="#07071a"/>
    </radialGradient>
    <linearGradient id="rope" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff2e88"/><stop offset="1" stop-color="#ff7a3d"/>
    </linearGradient>
    <linearGradient id="glove" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff4d6d"/><stop offset="1" stop-color="#b3123b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#e08a00"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)">
    <path d="M70 330 L256 410 L442 330" fill="none" stroke="url(#rope)" stroke-width="18" stroke-linecap="round"/>
    <path d="M70 290 L256 370 L442 290" fill="none" stroke="#22d3ee" stroke-width="14" stroke-linecap="round"/>
    <rect x="58" y="230" width="26" height="130" rx="10" fill="#e8e8f4"/>
    <rect x="428" y="230" width="26" height="130" rx="10" fill="#e8e8f4"/>
    <g transform="translate(256 220) rotate(-18)">
      <ellipse cx="0" cy="0" rx="92" ry="106" fill="url(#glove)"/>
      <ellipse cx="-30" cy="-40" rx="34" ry="22" fill="#fff" opacity=".28"/>
      <path d="M-62 58 Q0 96 62 58 L56 120 Q0 140 -56 120Z" fill="#fff"/>
      <rect x="-56" y="104" width="112" height="22" rx="8" fill="url(#gold)"/>
      <path d="M40 -10 Q96 0 86 52 Q70 70 46 50" fill="#d01848"/>
    </g>
    <path d="M256 70 L272 112 L318 112 L281 138 L295 182 L256 156 L217 182 L231 138 L194 112 L240 112Z" fill="url(#gold)" stroke="#7a3d00" stroke-width="4"/>
  </g>
</svg>`;

const out = new URL('../public/icons/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function shot(file, size, pad) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#07071a">${art(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: out + file, clip: { x: 0, y: 0, width: size, height: size } });
}
await shot('icon-512.png', 512, 1);
await shot('icon-192.png', 192, 1);
await shot('maskable-512.png', 512, 0.78);
await shot('apple-touch-icon.png', 180, 0.9);
await browser.close();
console.log('icons written');
