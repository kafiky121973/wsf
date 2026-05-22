/** إزالة نصوص ترويجية قديمة من إعدادات المظهر */

const LEGACY_MARKERS = [
  "The Blueprint",
  "حصن رقمي مستقل",
  "الحصن الرقمي",
  "حصن رقمي",
  "Self-Hosted",
  "SQLite Sovereign",
  "Sovereign Archive",
  "أربعة أركان",
  "التمرد على المنظومة",
  "منصة «شفرة الفطرة»",
  "الكوادر، والطيبات",
  "الوعي، الخلفاء، الكوادر",
  "لمن قرر التمرد",
];

function isLegacyPromoText(value) {
  if (!value || typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return LEGACY_MARKERS.some((m) => v.includes(m));
}

function sanitizeThemeValue(value) {
  return isLegacyPromoText(value) ? "" : value;
}

module.exports = { isLegacyPromoText, sanitizeThemeValue, LEGACY_MARKERS };
