/**
 * Generates PWA icons for SuperBrain from an inline SVG.
 * Run once: node scripts/generate-icons.mjs
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../public/icons");
fs.mkdirSync(OUT, { recursive: true });

// SuperBrain icon: dark bg, cyan "SB" monogram, rounded square
function makeSvg(size) {
  const r  = Math.round(size * 0.18);   // corner radius
  const cx = size / 2;
  const cy = size / 2;
  // Two overlapping circles (neuron / brain motif) in cyan
  const r1 = size * 0.22;
  const r2 = size * 0.22;
  const ox = size * 0.11;  // offset between circles
  const strokeW = size * 0.045;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#0d1117"/>
  <!-- subtle grid dot -->
  <circle cx="${cx}" cy="${cy}" r="${size * 0.38}" fill="none" stroke="#00d4ff" stroke-width="${strokeW * 0.25}" opacity="0.12"/>
  <!-- left lobe -->
  <circle cx="${cx - ox}" cy="${cy}" r="${r1}" fill="none" stroke="#00d4ff" stroke-width="${strokeW}" opacity="0.9"/>
  <!-- right lobe -->
  <circle cx="${cx + ox}" cy="${cy}" r="${r2}" fill="none" stroke="#00d4ff" stroke-width="${strokeW}" opacity="0.9"/>
  <!-- centre connector dot -->
  <circle cx="${cx}" cy="${cy}" r="${strokeW * 0.9}" fill="#00d4ff"/>
  <!-- top node -->
  <circle cx="${cx}" cy="${cy - r1 * 0.82}" r="${strokeW * 0.55}" fill="#00d4ff" opacity="0.8"/>
  <!-- bottom node -->
  <circle cx="${cx}" cy="${cy + r1 * 0.82}" r="${strokeW * 0.55}" fill="#00d4ff" opacity="0.8"/>
</svg>`;
}

const sizes = [
  { name: "icon-72.png",           size: 72  },
  { name: "icon-96.png",           size: 96  },
  { name: "icon-128.png",          size: 128 },
  { name: "icon-144.png",          size: 144 },
  { name: "icon-152.png",          size: 152 },
  { name: "icon-192.png",          size: 192 },
  { name: "icon-384.png",          size: 384 },
  { name: "icon-512.png",          size: 512 },
  { name: "apple-touch-icon.png",  size: 180 },
  { name: "favicon-32.png",        size: 32  },
  { name: "favicon-16.png",        size: 16  },
];

for (const { name, size } of sizes) {
  await sharp(Buffer.from(makeSvg(size)))
    .png()
    .toFile(path.join(OUT, name));
  console.log(`✓ ${name}`);
}

// Also write favicon.svg to public root
fs.writeFileSync(
  path.join(__dirname, "../public/favicon.svg"),
  makeSvg(64),
);
console.log("✓ favicon.svg");

console.log("\nAll icons generated in public/icons/");
