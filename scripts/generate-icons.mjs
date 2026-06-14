/**
 * Generates SuperBrain app icons (PWA + iOS App Store + Android Play Store).
 * Run: node scripts/generate-icons.mjs
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Brand: deep forest green bg, gold SB monogram
function makeSvg(size) {
  const r = Math.round(size * 0.224); // ~same visual radius as iOS rounded square
  const fontSize = Math.round(size * 0.41);
  const textY = Math.round(size * 0.575);
  const ringR = Math.round(size * 0.362);
  const lineY = Math.round(size * 0.645);
  const lineX1 = Math.round(size * 0.256);
  const lineW = Math.round(size * 0.488);
  const lineH = Math.max(2, Math.round(size * 0.004));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#1a3a2a"/>
  <circle cx="${size/2}" cy="${size/2}" r="${ringR}" fill="none" stroke="#b8972a" stroke-width="${Math.max(1, Math.round(size*0.002))}" opacity="0.35"/>
  <text x="${size/2}" y="${textY}" font-family="Georgia,'Times New Roman',serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" fill="#b8972a" letter-spacing="${-Math.round(size*0.02)}">SB</text>
  <rect x="${lineX1}" y="${lineY}" width="${lineW}" height="${lineH}" rx="${Math.round(lineH/2)}" fill="#b8972a" opacity="0.55"/>
</svg>`;
}

// PWA icons (public/icons/)
const pwaDir = path.join(root, "public/icons");
fs.mkdirSync(pwaDir, { recursive: true });
const pwaSizes = [
  { name: "icon-72.png",          size: 72  },
  { name: "icon-96.png",          size: 96  },
  { name: "icon-128.png",         size: 128 },
  { name: "icon-144.png",         size: 144 },
  { name: "icon-152.png",         size: 152 },
  { name: "icon-192.png",         size: 192 },
  { name: "icon-384.png",         size: 384 },
  { name: "icon-512.png",         size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png",       size: 32  },
  { name: "favicon-16.png",       size: 16  },
];

// iOS App Store icons (public/icons/ios/)
const iosDir = path.join(root, "public/icons/ios");
fs.mkdirSync(iosDir, { recursive: true });
const iosSizes = [
  { name: "icon-1024.png", size: 1024 }, // App Store
  { name: "icon-180.png",  size: 180  }, // iPhone @3x
  { name: "icon-120.png",  size: 120  }, // iPhone @2x
  { name: "icon-167.png",  size: 167  }, // iPad Pro
  { name: "icon-152.png",  size: 152  }, // iPad @2x
  { name: "icon-76.png",   size: 76   }, // iPad @1x
  { name: "icon-40.png",   size: 40   }, // Spotlight
  { name: "icon-29.png",   size: 29   }, // Settings
];

// Android Play Store icons (public/icons/android/)
const androidDir = path.join(root, "public/icons/android");
fs.mkdirSync(androidDir, { recursive: true });
const androidSizes = [
  { name: "icon-512.png", size: 512 }, // Play Store listing
  { name: "icon-192.png", size: 192 }, // xxxhdpi
  { name: "icon-144.png", size: 144 }, // xxhdpi
  { name: "icon-96.png",  size: 96  }, // xhdpi
  { name: "icon-72.png",  size: 72  }, // hdpi
  { name: "icon-48.png",  size: 48  }, // mdpi
];

async function gen(sizes, dir, label) {
  console.log(`\n${label}`);
  for (const { name, size } of sizes) {
    await sharp(Buffer.from(makeSvg(size))).png().toFile(path.join(dir, name));
    console.log(`  ✓ ${name} (${size}×${size})`);
  }
}

await gen(pwaSizes, pwaDir, "PWA icons → public/icons/");
await gen(iosSizes, iosDir, "iOS icons → public/icons/ios/");
await gen(androidSizes, androidDir, "Android icons → public/icons/android/");

// Update favicon.svg with new brand
fs.writeFileSync(path.join(root, "public/favicon.svg"), makeSvg(64));
console.log("\n  ✓ favicon.svg updated");
console.log("\n✅ Done. Key files:");
console.log("   App Store upload:  public/icons/ios/icon-1024.png");
console.log("   Play Store upload: public/icons/android/icon-512.png");
