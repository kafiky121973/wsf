/**
 * تحويل logo.webp إلى PNG وأيقونات — يتطلب sharp (اختياري على السيرفر).
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "static", "icons");
const webp = path.join(dir, "logo.webp");

async function main() {
  if (!fs.existsSync(webp)) {
    console.warn("convert-logo: لا يوجد logo.webp — تخطي.");
    return;
  }
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.warn("convert-logo: حزمة sharp غير مثبتة — تخطي (ضع logo.png يدوياً أو شغّل npm run assets محلياً).");
    return;
  }
  await sharp(webp).png().toFile(path.join(dir, "logo.png"));
  for (const size of [192, 512]) {
    await sharp(webp)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(path.join(dir, `icon-${size}.png`));
    console.log("✓", `icon-${size}.png`);
  }
  await sharp(webp).resize(64, 64, { fit: "cover" }).png().toFile(path.join(dir, "favicon.png"));
  console.log("✓ favicon.png + logo.png");
}

main().catch((e) => {
  console.warn("convert-logo:", e.message);
});
