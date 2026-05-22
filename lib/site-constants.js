const fs = require("fs");
const path = require("path");

/** نصوص ثابتة — تظهر حتى لو قاعدة البيانات على السيرفر قديمة */
const HERO_TAGLINE =
  "المنظومة تُريدُك 'مُسيَّراً'.... كُن أنت 'سيد القرار' واسترد سيادتك.";

const LOGO_PNG = "/static/icons/logo.png";
const LOGO_WEBP = "/static/icons/logo.webp";
const LOGO_SVG = "/static/icons/icon.svg";
const ICONS_DIR = path.join(__dirname, "..", "static", "icons");

function resolveLogoUrl() {
  const webpPath = path.join(ICONS_DIR, "logo.webp");
  const pngPath = path.join(ICONS_DIR, "logo.png");
  const svgPath = path.join(ICONS_DIR, "icon.svg");
  const hasWebp = fs.existsSync(webpPath);
  const hasPng = fs.existsSync(pngPath);

  if (hasWebp && hasPng) {
    const webpNewer = fs.statSync(webpPath).mtimeMs > fs.statSync(pngPath).mtimeMs;
    return webpNewer ? LOGO_WEBP : LOGO_PNG;
  }
  if (hasWebp) return LOGO_WEBP;
  if (hasPng) return LOGO_PNG;
  if (fs.existsSync(svgPath)) return LOGO_SVG;
  return LOGO_PNG;
}

function isLogoSvg(url) {
  return String(url || "").toLowerCase().endsWith(".svg");
}

module.exports = {
  HERO_TAGLINE,
  LOGO_PNG,
  LOGO_WEBP,
  LOGO_SVG,
  resolveLogoUrl,
  isLogoSvg,
};
