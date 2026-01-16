#!/usr/bin/env node

/**
 * PWA Icon Generator for TEEEM
 *
 * Generates PNG icons for the PWA manifest using sharp.
 * Run: node scripts/generate-pwa-icons.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// TEEEM brand colors
const BRAND_COLOR = '#4f46e5'; // indigo-600
const TEXT_COLOR = '#ffffff';

/**
 * Generate SVG icon with "T" letter for TEEEM
 */
function generateSvgIcon(size) {
  const fontSize = Math.floor(size * 0.55);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.floor(size * 0.15)}" fill="${BRAND_COLOR}"/>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="700" font-size="${fontSize}" fill="${TEXT_COLOR}">T</text>
</svg>`;
}

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log('Generating PWA icons for TEEEM...\n');

  for (const size of SIZES) {
    const svg = generateSvgIcon(size);
    const svgBuffer = Buffer.from(svg);
    const pngFilename = `icon-${size}x${size}.png`;
    const pngPath = path.join(ICONS_DIR, pngFilename);

    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(pngPath);
      console.log(`Created: ${pngFilename}`);
    } catch (err) {
      console.error(`Failed to create ${pngFilename}:`, err.message);
    }
  }

  console.log('\n✓ PWA icons generated successfully!');
}

generateIcons().catch(console.error);
