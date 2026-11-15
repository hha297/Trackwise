import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'assets/images/branding/logo.png');
const out = path.join(root, 'assets/images/branding/logo-splash.png');

const size = 303;
/** ~16px at splash imageWidth 112 */
const radius = Math.round(16 * (size / 112));

const mask = Buffer.from(
  `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>
  </svg>`,
);

await sharp(src)
  .ensureAlpha()
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toFile(out);

console.log(`Wrote ${out} (rx=${radius})`);
