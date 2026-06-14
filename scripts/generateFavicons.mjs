/**
 * Generate Arden Project OS favicon + OG preview assets.
 * Run: npm run generate:favicons
 *
 * Outputs:
 *   public/favicon.ico           (16 + 32 px)
 *   public/favicon-16x16.png
 *   public/favicon-32x32.png
 *   public/favicon.svg           (branded SVG, scalable)
 *   public/apple-touch-icon.png  (180x180)
 *   public/icon-192.png          (PWA / manifest)
 *   public/icon-512.png          (PWA / manifest)
 *   public/og-image.png          (1200x630, for iMessage / social)
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceIcon = join(root, 'src/assets/images/Favicon.png');
const sourceBanner = join(root, 'src/assets/images/logo_dark_banner_simple.png');
const publicDir = join(root, 'public');

const BG_DARK = '#020617';

// ── Square icon with padded mark on dark background ──────────────────────────
async function renderIcon(size, outPath, { paddingRatio = 0.14 } = {}) {
  const padding = Math.max(1, Math.round(size * paddingRatio));
  const inner = size - padding * 2;

  const mark = await sharp(sourceIcon)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG_DARK },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(outPath);
}

// ── .ico from PNG buffers ─────────────────────────────────────────────────────
async function writeIco(pngPaths, outPath) {
  const { default: toIco } = await import('to-ico');
  const buffers = pngPaths.map((p) => readFileSync(p));
  writeFileSync(outPath, await toIco(buffers));
}

// ── OG image: 1200×630 dark canvas with banner logo centered ─────────────────
async function renderOgImage(outPath) {
  const OG_W = 1200;
  const OG_H = 630;
  const PAD = 80; // padding around the logo

  // Scale banner to fit inside padded box, preserving aspect ratio
  const maxW = OG_W - PAD * 2;
  const maxH = OG_H - PAD * 2;

  const banner = await sharp(sourceBanner)
    .resize(maxW, maxH, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const meta = await sharp(banner).metadata();
  const bw = meta.width ?? maxW;
  const bh = meta.height ?? maxH;

  // Center within canvas
  const left = Math.round((OG_W - bw) / 2);
  const top = Math.round((OG_H - bh) / 2);

  await sharp({
    create: { width: OG_W, height: OG_H, channels: 4, background: BG_DARK },
  })
    .composite([{ input: banner, left, top }])
    .png()
    .toFile(outPath);
}

// ── Minimal branded SVG favicon ───────────────────────────────────────────────
function writeFaviconSvg(outPath) {
  // Simple "A" mark on dark background — scales perfectly at any size
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#020617"/>
  <text x="16" y="23" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
        font-size="19" font-weight="800" fill="#22d3ee" text-anchor="middle"
        dominant-baseline="auto" letter-spacing="-0.5">A</text>
</svg>`;
  writeFileSync(outPath, svg, 'utf8');
}

// ── Run ───────────────────────────────────────────────────────────────────────

const squareIcons = [
  ['favicon-16x16.png',   16,  { paddingRatio: 0.10 }],
  ['favicon-32x32.png',   32,  { paddingRatio: 0.12 }],
  ['apple-touch-icon.png', 180, { paddingRatio: 0.14 }],
  ['icon-192.png',         192, { paddingRatio: 0.14 }],
  ['icon-512.png',         512, { paddingRatio: 0.14 }],
];

for (const [name, size, opts] of squareIcons) {
  await renderIcon(size, join(publicDir, name), opts);
  console.log(`  ✓  ${name}`);
}

const p16 = join(publicDir, 'favicon-16x16.png');
const p32 = join(publicDir, 'favicon-32x32.png');
await writeIco([p16, p32], join(publicDir, 'favicon.ico'));
console.log('  ✓  favicon.ico');

writeFaviconSvg(join(publicDir, 'favicon.svg'));
console.log('  ✓  favicon.svg');

await renderOgImage(join(publicDir, 'og-image.png'));
console.log('  ✓  og-image.png  (1200×630)');

console.log('\nAll assets written to public/');
