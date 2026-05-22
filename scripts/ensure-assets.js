/**
 * يتحقق من أصول الشعار — لا يفشل npm install على السيرفر.
 */
const fs = require("fs");
const path = require("path");

const iconsDir = path.join(__dirname, "..", "static", "icons");
const logoPng = path.join(iconsDir, "logo.png");
const logoWebp = path.join(iconsDir, "logo.webp");
const iconSvg = path.join(iconsDir, "icon.svg");
const faviconPng = path.join(iconsDir, "favicon.png");

function hasSharp() {
  try {
    require.resolve("sharp");
    return true;
  } catch {
    return false;
  }
}

async function fromWebp() {
  if (!fs.existsSync(logoWebp) || !hasSharp()) return false;
  try {
    const { execSync } = require("child_process");
    execSync("node scripts/convert-logo.js", {
      cwd: path.join(__dirname, ".."),
      stdio: "pipe",
    });
    return fs.existsSync(logoPng);
  } catch {
    return false;
  }
}

async function fromSvg() {
  if (!hasSharp() || !fs.existsSync(iconSvg)) return false;
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    return false;
  }
  for (const size of [512, 192, 64]) {
    const out =
      size === 64 ? faviconPng : path.join(iconsDir, `icon-${size}.png`);
    await sharp(iconSvg).resize(size, size).png().toFile(out);
    console.log("✓", path.basename(out));
  }
  if (!fs.existsSync(logoWebp) && !fs.existsSync(logoPng)) {
    await sharp(iconSvg).resize(512, 512).png().toFile(logoPng);
    console.log("✓ logo.png (من icon.svg)");
  }
  return true;
}

function iconsComplete() {
  return (
    fs.existsSync(logoPng) &&
    fs.existsSync(faviconPng) &&
    fs.existsSync(path.join(iconsDir, "icon-192.png")) &&
    fs.existsSync(path.join(iconsDir, "icon-512.png"))
  );
}

async function main() {
  if (iconsComplete()) {
    console.log("أصول الشعار و PWA (192/512) موجودة.");
    return;
  }
  if (await fromWebp()) return;
  if (fs.existsSync(logoPng)) {
    console.log("الشعار:", logoPng);
    return;
  }
  if (await fromSvg()) return;
  console.warn(
    "⚠ تخطّي توليد الشعار — الموقع يستخدم icon.svg. (اختياري: ضع logo.webp أو شغّل npm run assets على جهازك)"
  );
}

main()
  .catch((e) => console.warn("ensure-assets:", e.message))
  .finally(() => process.exit(0));
