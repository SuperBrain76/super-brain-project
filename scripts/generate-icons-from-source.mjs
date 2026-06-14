import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = "/Users/dylanfjellstrom/Downloads/Superbrain_appstorelogo.png";

const pwaDir = join(root, "public/icons");
const iosDir = join(root, "public/icons/ios");
const androidDir = join(root, "public/icons/android");
mkdirSync(pwaDir, { recursive: true });
mkdirSync(iosDir, { recursive: true });
mkdirSync(androidDir, { recursive: true });

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

const iosSizes = [
  { name: "icon-1024.png", size: 1024 },
  { name: "icon-180.png",  size: 180  },
  { name: "icon-120.png",  size: 120  },
  { name: "icon-167.png",  size: 167  },
  { name: "icon-152.png",  size: 152  },
  { name: "icon-76.png",   size: 76   },
  { name: "icon-40.png",   size: 40   },
  { name: "icon-29.png",   size: 29   },
];

const androidSizes = [
  { name: "icon-512.png", size: 512 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-144.png", size: 144 },
  { name: "icon-96.png",  size: 96  },
  { name: "icon-72.png",  size: 72  },
  { name: "icon-48.png",  size: 48  },
];

async function gen(sizes, dir, label) {
  console.log(`\n${label}`);
  for (const { name, size } of sizes) {
    await sharp(src).resize(size, size).png().toFile(join(dir, name));
    console.log(`  ✓ ${name} (${size}×${size})`);
  }
}

await gen(pwaSizes, pwaDir, "PWA icons → public/icons/");
await gen(iosSizes, iosDir, "iOS icons → public/icons/ios/");
await gen(androidSizes, androidDir, "Android icons → public/icons/android/");

console.log("\n✅ Done.");
console.log("   App Store upload:  public/icons/ios/icon-1024.png");
console.log("   Play Store upload: public/icons/android/icon-512.png");
