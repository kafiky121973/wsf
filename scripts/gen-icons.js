/** توليد أيقونات PNG للـ PWA من SVG */
const fs = require("fs");
const path = require("path");

async function main() {
  let Jimp;
  try {
    Jimp = require("jimp");
  } catch {
    console.log("تثبيت jimp…");
    require("child_process").execSync("npm install jimp@0.22 --no-save", {
      stdio: "inherit",
      cwd: path.join(__dirname, ".."),
    });
    Jimp = require("jimp");
  }

  const outDir = path.join(__dirname, "..", "static", "icons");
  const svgPath = path.join(outDir, "icon.svg");
  const svg = fs.readFileSync(svgPath, "utf8");

  for (const size of [192, 512]) {
    const img = new Jimp(size, size, 0x0d0b08ff);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const gold = new Jimp(size, size, 0xc9a227ff);
    gold.scan(0, 0, size, size, function (x, y, idx) {
      const cx = size / 2;
      const cy = size / 2;
      const dx = (x - cx) / (size * 0.38);
      const dy = (y - cy) / (size * 0.42);
      if (dx * dx + dy * dy > 1) this.bitmap.data[idx + 3] = 0;
    });
    img.composite(gold, 0, 0);
    await img.print(font, 0, Math.floor(size * 0.38), {
      text: "✦",
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
    }, size, size);
    await img.writeAsync(path.join(outDir, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
