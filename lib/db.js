const fs = require("fs");
const path = require("path");
const { createDatabase } = require("./sqlite-driver");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "shifra.db");

const SCHEMA = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

function getDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = createDatabase(DB_PATH);
  db.pragma("foreign_keys = ON");
  return db;
}

function initDb() {
  const db = getDb();
  db.exec(SCHEMA);
  const { migrateSchema } = require("./migrate");
  migrateSchema(db);
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count === 0) seed(db);
  db.close();
}

function seed(db) {
  const now = new Date().toISOString();
  const adminHash = bcrypt.hashSync("admin123", 10);
  const designerHash = bcrypt.hashSync("designer123", 10);

  db.prepare(
    `INSERT INTO users (username, email, password_hash, full_name, role, status, created_at, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("admin", "admin@shifra.local", adminHash, "مدير الحصن", "admin", "active", now, now);
  db.prepare(
    `INSERT INTO users (username, email, password_hash, full_name, role, status, created_at, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("designer", "designer@shifra.local", designerHash, "مصمم الشفرة", "designer", "active", now, now);

  const perms = [
    ["admin", "users", 1, 1, 1],
    ["admin", "permissions", 1, 1, 1],
    ["admin", "library", 1, 1, 1],
    ["admin", "community", 1, 1, 1],
    ["admin", "cadres", 1, 1, 1],
    ["admin", "market", 1, 1, 1],
    ["admin", "newsletter", 1, 1, 1],
    ["admin", "theme", 1, 1, 1],
    ["supervisor", "community", 1, 1, 0],
    ["supervisor", "users", 1, 1, 0],
    ["supervisor", "library", 1, 0, 0],
    ["designer", "theme", 1, 1, 0],
    ["cadre", "consultations", 1, 1, 0],
    ["cadre", "knowledge", 1, 1, 0],
    ["member", "library", 1, 0, 0],
    ["member", "community", 1, 1, 0],
    ["member", "journals", 1, 1, 0],
    ["member", "market", 1, 1, 0],
    ["member", "consultations", 1, 1, 0],
  ];
  const insPerm = db.prepare(
    `INSERT OR IGNORE INTO role_permissions (role, resource, can_read, can_write, can_delete) VALUES (?, ?, ?, ?, ?)`
  );
  perms.forEach((p) => insPerm.run(...p));

  const theme = {
    site_name: "شفرة الفطرة",
    site_subtitle: "",
    primary_color: "#C9A227",
    secondary_color: "#1A1510",
    accent_color: "#8B6914",
    background_gradient: "linear-gradient(135deg, #0D0B08 0%, #1A1510 50%, #2A2218 100%)",
    font_family: "'Amiri', 'Segoe UI', serif",
    hero_tagline:
      "المنظومة تُريدُك 'مُسيَّراً'.. كُن أنت 'سيد القرار' واسترد سيادتك.",
    logo_text: "شفرة الفطرة",
  };
  const insTheme = db.prepare(
    `INSERT OR IGNORE INTO theme_settings (key, value, updated_at) VALUES (?, ?, ?)`
  );
  Object.entries(theme).forEach(([k, v]) => insTheme.run(k, v, now));

  db.prepare(
    `INSERT INTO sovereignty_statement (version, title, content, is_active, created_at) VALUES (1, ?, ?, 1, ?)`
  ).run(
    "بيان استرداد السيادة",
    `أقرّ بأنني أقبل الدخول إلى حصن شفرة الفطرة بجدية تامة، لا للتسلية ولا للتجريب السطحي.
أتعهد بالالتزام بمنهج التطهير والبناء والوعي، واحترام قواعد المجتمع المغلق.
أفهم أن العضوية هبة وليست حقاً مفتوحاً، وأن الرقباء يحق لهم رفض أو إيقاف عضويتي عند مخالفة هذا الإقرار.`,
    now
  );

  const levels = [
    [1, "مرحلة التطهير", "Purification", "الـ40 يوماً، تنظيف الجسد، قطع السكر والدقيق والزيوت ومنتجات المصانع", "🜂"],
    [2, "مرحلة بناء الهاردوير", "Hardware Build", "بناء الجسد بالطيبات، أنظمة التغذية، والرياضة الفطرية", "⚔"],
    [3, "مرحلة استرداد الوعي", "Consciousness Recovery", "تدبر القرآن، سجدات التحرر، وفك شفرات المنظومة النفسية", "☪"],
  ];
  const insLevel = db.prepare(
    `INSERT INTO library_levels (level_number, name_ar, name_en, description, icon) VALUES (?, ?, ?, ?, ?)`
  );
  levels.forEach((l) => insLevel.run(...l));

  const cats = [
    [1, "الأربعون يوماً", "forty-days", "منهج التطهير الكامل"],
    [1, "قطع السموم الغذائية", "cut-toxins", "السكر، الدقيق، الزيوت، المصانع"],
    [2, "الطيبات والتغذية", "tayyibat", "بناء الجسد بالحلال الطيب"],
    [2, "الرياضة الفطرية", "fitra-sport", "حركة الجسد على الفطرة"],
    [3, "تدبر القرآن", "quran-tadabbur", "استرداد الوعي بالكتاب"],
    [3, "سجدات التحرر", "liberation-sujud", "العبادة كتحرر نفسي"],
    [3, "شفرات المنظومة", "system-codes", "فك التلاعب النفسي"],
  ];
  const insCat = db.prepare(
    `INSERT INTO library_categories (level_id, name_ar, slug, description) VALUES (?, ?, ?, ?)`
  );
  cats.forEach((c) => insCat.run(...c));

  const insVid = db.prepare(
    `INSERT INTO videos (category_id, title, description, duration_seconds, transcript_text, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insSeg = db.prepare(
    `INSERT INTO video_transcript_segments (video_id, start_seconds, end_seconds, text) VALUES (?, ?, ?, ?)`
  );

  const v1 = insVid.run(
    2,
    "خطورة السكر على الفطرة",
    "شرح علمي لأضرار السكر...",
    600,
    "السكر يدمر الخلايا. يجب قطع السكر تدريجياً خلال الأربعين يوماً.",
    now
  ).lastInsertRowid;
  [
    [0, 120, "السكر يدمر الخلايا ويُسبب الالتهاب المزمن."],
    [120, 300, "يجب قطع السكر تدريجياً خلال الأربعين يوماً."],
    [300, 600, "البدائل الطبيعية: التمر والعسل الخام باعتدال."],
  ].forEach((s) => insSeg.run(v1, s[0], s[1], s[2]));

  const v2 = insVid.run(
    2,
    "كيف تقطع الدقيق الأبيض",
    "بروتوكول عملي...",
    480,
    "الدقيق الأبيض يسبب ارتفاع الإنسولين.",
    now
  ).lastInsertRowid;
  [
    [0, 240, "الدقيق الأبيض يرفع الإنسولين بسرعة."],
    [240, 480, "استبدله بالحبوب الكاملة بعد انتهاء التطهير."],
  ].forEach((s) => insSeg.run(v2, s[0], s[1], s[2]));

  db.prepare(
    `INSERT INTO knowledge_articles (author_id, title, content, category, verified_signature, is_published, created_at)
     VALUES (1, ?, ?, ?, ?, 1, ?)`
  ).run(
    "بروتوكول فطري: قطع السكر",
    "المحتوى العلمي الكامل عن قطع السكر وفوائده على الجهاز الهضمي والهرمونات...",
    "تغذية",
    "د. الحصن — موثق",
    now
  );

  db.prepare(
    `INSERT INTO cadre_profiles (user_id, specialty, bio, fitra_exam_passed, verified_signature)
     VALUES (1, ?, ?, 1, ?)`
  ).run("طب فطري", "مستشار معتمد في بروتوكولات الفطرة", "د. الحصن");

  const points = [
    ["سوق الرياض — الشمال", "الرياض", "الرياض", "حي النخيل", 24.7, 46.7],
    ["سوق جدة — الغرب", "مكة", "جدة", "حي الصفا", 21.5, 39.2],
    ["سوق القاهرة", "مصر", "القاهرة", "مدينة نصر", 30.0, 31.3],
  ];
  const insPt = db.prepare(
    `INSERT INTO distribution_points (name, region, city, address, lat, lng, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  );
  points.forEach((p) => insPt.run(p[0], p[1], p[2], p[3], p[4], p[5], now));

  const insProd = db.prepare(
    `INSERT INTO market_products (point_id, name, description, price_note, is_available, sort_order, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  );
  const samples = [
    ["تمر عجوة فاخر", "تمر طبيعي بدون معالجة", "حسب الكيلو"],
    ["سمن بلدي", "سمن حيواني طبيعي", "حسب الوزن"],
    ["عسل خام", "عسل خام غير مبستر", "حسب البرطمان"],
  ];
  db.prepare("SELECT id FROM distribution_points")
    .all()
    .forEach((row) => {
      samples.forEach((s, i) => insProd.run(row.id, s[0], s[1], s[2], i + 1, now));
    });
}

function getTheme(db) {
  const defaults = {
    site_name: "شفرة الفطرة",
    site_subtitle: "",
    primary_color: "#C9A227",
    secondary_color: "#1A1510",
    accent_color: "#8B6914",
    background_gradient: "linear-gradient(135deg, #0D0B08 0%, #1A1510 50%, #2A2218 100%)",
    font_family: "'Amiri', 'Segoe UI', serif",
    hero_tagline:
      "المنظومة تُريدُك 'مُسيَّراً'.. كُن أنت 'سيد القرار' واسترد سيادتك.",
    logo_text: "شفرة الفطرة",
  };
  const rows = db.prepare("SELECT key, value FROM theme_settings").all();
  const theme = { ...defaults };
  const { sanitizeThemeValue } = require("./theme-sanitize");
  rows.forEach((r) => {
    const v = sanitizeThemeValue(r.value);
    if (v !== "" && v != null) theme[r.key] = v;
  });
  if (!String(theme.hero_tagline || "").trim()) {
    theme.hero_tagline = defaults.hero_tagline;
  }
  return theme;
}

module.exports = { getDb, initDb, getTheme, DB_PATH };
