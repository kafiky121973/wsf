/** ترقية قاعدة البيانات: اختبار وعي مفتوح (5 أسئلة) */
const AWARENESS_QUESTIONS = [
  {
    question: 'كيف ترى خديعة "حرية الاختيار" في منتجات المنظومة؟',
    hint: "فكّر في التسويق، الإدمان، ووهم أن الاستهلاك حرية.",
    min_chars: 50,
  },
  {
    question: "ما هو الرابط بين طهارة البطن وخشوع القلب؟",
    hint: "اربط بين التغذية الفطرية والعبادة والسكينة الداخلية.",
    min_chars: 50,
  },
  {
    question: 'كيف تهكر الشاشات إرادتك، وما هو "الاستغناء السيادي"؟',
    hint: "المصفوفة الرقمية، التركيز، والقطع الواعي لا العزلة الجبانة.",
    min_chars: 50,
  },
  {
    question: 'كيف تدير "الاشتباك الاضطراري" في عملك الحالي؟',
    hint: "الواقع العملي دون الانسلاخ عن المنهج أو الانهيار.",
    min_chars: 50,
  },
  {
    question: "ما الذي يجعل قرارك بالـ 40 يوماً قراراً سيادياً لا مجرد دايت؟",
    hint: "الفرق بين التحرر من المنظومة وبين حمية مؤقتة.",
    min_chars: 50,
  },
];

function migrateSchema(db) {
  const cols = db.prepare("PRAGMA table_info(quiz_questions)").all();
  const hasOld = cols.some((c) => c.name === "options_json");

  if (hasOld) {
    db.exec(`
      CREATE TABLE quiz_questions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        hint TEXT,
        min_chars INTEGER NOT NULL DEFAULT 50,
        is_active INTEGER NOT NULL DEFAULT 1,
        order_num INTEGER DEFAULT 0
      );
    `);
    db.exec("DROP TABLE IF EXISTS quiz_questions");
    db.exec("ALTER TABLE quiz_questions_new RENAME TO quiz_questions");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      hint TEXT,
      min_chars INTEGER NOT NULL DEFAULT 50,
      is_active INTEGER NOT NULL DEFAULT 1,
      order_num INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
      answer_text TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      UNIQUE(user_id, question_id)
    );
  `);

  const userCols = db.prepare("PRAGMA table_info(users)").all();
  if (!userCols.some((c) => c.name === "quiz_review_note")) {
    try {
      db.exec("ALTER TABLE users ADD COLUMN quiz_review_note TEXT");
    } catch (_) {
      /* column may exist */
    }
  }

  seedAwarenessQuestions(db);
  migrateUserLocation(db);
  migrateThemeBranding(db);
  migrateLibrary(db);
  migrateNewsletterPush(db);
  migrateOwnerMessages(db);
  migrateAuthEmail(db);
  migrateJournal(db);
  migrateGallery(db);
  migrateSiteSettings(db);
  migrateAutoActivateMembers(db);
  migrateMarket(db);
  migrateRoleNav(db);
  migratePresenceSessions(db);
  const { migrateChatFeedback } = require("./chat-feedback");
  migrateChatFeedback(db);
}

function migratePresenceSessions(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS presence_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_presence_sessions_user ON presence_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_presence_sessions_open ON presence_sessions(user_id, ended_at);
  `);
}

function migrateRoleNav(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_nav_items (
      role TEXT NOT NULL,
      item_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (role, item_key)
    );
  `);
  const { ensureRoleNavSeeded } = require("./nav-menu");
  ensureRoleNavSeeded(db);
}

function migrateMarket(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      point_id INTEGER NOT NULL REFERENCES distribution_points(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      price_note TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  db.prepare(
    `UPDATE distribution_points SET name = REPLACE(name, 'محراب', 'سوق') WHERE name LIKE '%محراب%'`
  ).run();

  const productCount = db.prepare("SELECT COUNT(*) AS c FROM market_products").get().c;
  if (productCount > 0) return;

  const points = db.prepare("SELECT id, city FROM distribution_points").all();
  if (!points.length) return;

  const now = new Date().toISOString();
  const ins = db.prepare(
    `INSERT INTO market_products (point_id, name, description, price_note, is_available, sort_order, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  );

  const samples = [
    ["تمر عجوة فاخر", "تمر طبيعي بدون معالجة", "حسب الكيلو"],
    ["سمن بلدي", "سمن حيواني طبيعي", "حسب الوزن"],
    ["عسل خام", "عسل خام غير مبستر", "حسب البرطمان"],
  ];

  points.forEach((p, idx) => {
    samples.forEach((s, i) => {
      ins.run(p.id, s[0], s[1], s[2], i + 1, now);
    });
  });
}

function migrateSiteSettings(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/** لم يعد يُفعّل الجميع تلقائياً — علامة لمرة واحدة فقط */
function migrateAutoActivateMembers(db) {
  migrateSiteSettings(db);
  const done = db
    .prepare("SELECT 1 AS ok FROM site_settings WHERE key = 'legacy_auto_activate_v1'")
    .get();
  if (done) return;
  db.prepare(
    `INSERT INTO site_settings (key, value) VALUES ('legacy_auto_activate_v1', ?)`
  ).run(new Date().toISOString());
}

function migrateGallery(db) {
  const cols = db.prepare("PRAGMA table_info(community_posts)").all().map((c) => c.name);
  if (!cols.includes("youtube_url")) {
    try {
      db.exec("ALTER TABLE community_posts ADD COLUMN youtube_url TEXT");
    } catch (_) {}
  }

  const approved = db.prepare("SELECT COUNT(*) AS c FROM community_posts WHERE status = 'approved'").get().c;
  if (approved > 0) return;

  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!admin) return;

  const now = new Date().toISOString();
  const ins = db.prepare(
    `INSERT INTO community_posts (user_id, post_type, title, content, status, created_at, reviewed_at)
     VALUES (?, ?, ?, ?, 'approved', ?, ?)`
  );
  ins.run(
    admin.id,
    "testimony",
    "40 يوماً غيّرت علاقتي بالطعام",
    "بعد قطع السكر والدقيق الأبيض، عادت الطاقة تدريجياً. ليس حمية — بل استرداد للسيادة على جسدي. أنصح كل من يريد البدء أن يثبت يومياته ولا يستعجل.",
    now,
    now
  );
  ins.run(
    admin.id,
    "testimony",
    "من التيه إلى الوعي",
    "كنت أستهلك ما تُسوّقه المنظومة دون تفكير. منصة شفرة الفطرة أعادتني إلى سؤال واحد: هل هذا فطري أم مُلقَّن؟",
    now,
    now
  );
}

function migrateJournal(db) {
  const cols = db.prepare("PRAGMA table_info(journals)").all().map((c) => c.name);
  if (!cols.includes("day_number")) {
    try {
      db.exec("ALTER TABLE journals ADD COLUMN day_number INTEGER");
    } catch (_) {}
  }
}

function migrateLibrary(db) {
  const vcols = db.prepare("PRAGMA table_info(videos)").all().map((c) => c.name);
  if (!vcols.includes("youtube_url")) {
    try {
      db.exec("ALTER TABLE videos ADD COLUMN youtube_url TEXT");
    } catch (_) {}
  }

  const count = db.prepare("SELECT COUNT(*) AS c FROM videos").get().c;
  if (count >= 4) return;

  const now = new Date().toISOString();
  const has = db.prepare("SELECT id FROM videos WHERE title = ?").get("منهج الأربعين يوماً — البداية");
  if (has) return;

  const insVid = db.prepare(
    `INSERT INTO videos (category_id, title, description, duration_seconds, transcript_text, is_published, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  );
  const insSeg = db.prepare(
    `INSERT INTO video_transcript_segments (video_id, start_seconds, end_seconds, text) VALUES (?, ?, ?, ?)`
  );

  const v3 = insVid.run(
    1,
    "منهج الأربعين يوماً — البداية",
    "كيف تبدأ رحلة التطهير السيادي خطوة بخطوة",
    720,
    "الأربعون يوماً ليست حمية مؤقتة — بل استرداد للسيادة على جسدك وعقلك.",
    now
  ).lastInsertRowid;
  [
    [0, 180, "الأربعون يوماً ليست حمية — بل عقد مع نفسك."],
    [180, 420, "ابدأ بقطع السكر والدقيق والزيوت الصناعية."],
    [420, 720, "سجّل إنجازك يومياً في مفكرة الخلفاء."],
  ].forEach((s) => insSeg.run(v3, s[0], s[1], s[2]));

  const v4 = insVid.run(
    5,
    "تدبر آية — الوعي بالخالق",
    "استرداد الوعي عبر التدبر لا التلقين",
    540,
    "التدبر يعيد برمجة العقل على فطرة الله لا على إيقاع المنظومة.",
    now
  ).lastInsertRowid;
  [
    [0, 270, "التدبر يعيد برمجة العقل على الفطرة."],
    [270, 540, "اقرأ ببطء — اسأل: ماذا يطلب مني الخالق هنا؟"],
  ].forEach((s) => insSeg.run(v4, s[0], s[1], s[2]));
}

function migrateThemeBranding(db) {
  const { isLegacyPromoText } = require("./theme-sanitize");
  const rows = db.prepare("SELECT key, value FROM theme_settings").all();
  const upd = db.prepare("UPDATE theme_settings SET value = ?, updated_at = ? WHERE key = ?");
  const now = new Date().toISOString();
  rows.forEach((r) => {
    if (isLegacyPromoText(r.value)) upd.run("", now, r.key);
  });
  db.prepare(
    `UPDATE theme_settings SET value = '', updated_at = ?
     WHERE value LIKE '%Self-Hosted%' OR value LIKE '%SQLite Sovereign%' OR value LIKE '%Sovereign Archive%'`
  ).run(now);

  const { HERO_TAGLINE } = require("./site-constants");
  const tagline = HERO_TAGLINE;
  const oldTwoDots =
    "المنظومة تُريدُك 'مُسيَّراً'.. كُن أنت 'سيد القرار' واسترد سيادتك.";
  const hero = db.prepare("SELECT value FROM theme_settings WHERE key = 'hero_tagline'").get();
  const heroEmpty = !hero || !String(hero.value || "").trim();
  const heroLegacy = hero && isLegacyPromoText(hero.value);
  const heroOldDots = hero && String(hero.value || "").trim() === oldTwoDots;
  if (heroEmpty || heroLegacy || heroOldDots) {
    if (!hero) {
      db.prepare(
        `INSERT INTO theme_settings (key, value, updated_at) VALUES ('hero_tagline', ?, ?)`
      ).run(tagline, now);
    } else {
      upd.run(tagline, now, "hero_tagline");
    }
  }
}

function migrateNewsletterPush(db) {
  const cols = db.prepare("PRAGMA table_info(newsletters)").all().map((c) => c.name);
  const add = (name, sql) => {
    if (!cols.includes(name)) db.exec(sql);
  };
  add("source_type", "ALTER TABLE newsletters ADD COLUMN source_type TEXT");
  add("source_ref", "ALTER TABLE newsletters ADD COLUMN source_ref TEXT");
  add("link_url", "ALTER TABLE newsletters ADD COLUMN link_url TEXT");
  add("auto_generated", "ALTER TABLE newsletters ADD COLUMN auto_generated INTEGER DEFAULT 0");

  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS newsletter_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const ins = db.prepare(
    `INSERT OR IGNORE INTO newsletter_settings (key, value, updated_at) VALUES (?, ?, ?)`
  );
  const now = new Date().toISOString();
  ins.run("auto_enabled", "1", now);
  ins.run("interval_hours", process.env.NEWSLETTER_INTERVAL_HOURS || "24", now);
}

function migrateAuthEmail(db) {
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (!cols.includes("email_verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
    db.exec(
      `UPDATE users SET email_verified_at = COALESCE(approved_at, created_at)
       WHERE email_verified_at IS NULL`
    );
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash, type);
  `);
}

function migrateOwnerMessages(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS owner_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('member', 'owner')),
      body TEXT NOT NULL,
      read_by_member INTEGER NOT NULL DEFAULT 0,
      read_by_owner INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_owner_messages_member ON owner_messages(member_id, created_at);
  `);
}

function migrateUserLocation(db) {
  const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  const add = (name, sql) => {
    if (!cols.includes(name)) db.exec(sql);
  };
  add("country", "ALTER TABLE users ADD COLUMN country TEXT");
  add("city", "ALTER TABLE users ADD COLUMN city TEXT");
  add("district", "ALTER TABLE users ADD COLUMN district TEXT");
  add("rejected_at", "ALTER TABLE users ADD COLUMN rejected_at TEXT");
  add("rejection_note", "ALTER TABLE users ADD COLUMN rejection_note TEXT");
  add("approval_email_sent", "ALTER TABLE users ADD COLUMN approval_email_sent INTEGER DEFAULT 0");
  add("lat", "ALTER TABLE users ADD COLUMN lat REAL");
  add("lng", "ALTER TABLE users ADD COLUMN lng REAL");
  add("location_updated_at", "ALTER TABLE users ADD COLUMN location_updated_at TEXT");
  add("last_seen_at", "ALTER TABLE users ADD COLUMN last_seen_at TEXT");
  add("admin_stars", "ALTER TABLE users ADD COLUMN admin_stars INTEGER");
  add("admin_suggestion", "ALTER TABLE users ADD COLUMN admin_suggestion TEXT");
  add("admin_rated_at", "ALTER TABLE users ADD COLUMN admin_rated_at TEXT");
  add("admin_rated_by", "ALTER TABLE users ADD COLUMN admin_rated_by INTEGER REFERENCES users(id)");
}

function seedAwarenessQuestions(db) {
  const row = db.prepare("PRAGMA table_info(quiz_questions)").all();
  if (!row.some((c) => c.name === "hint")) return;

  const first = db.prepare("SELECT id, hint FROM quiz_questions ORDER BY order_num LIMIT 1").get();
  if (first && first.hint != null && first.hint !== "") return;

  const n = db.prepare("SELECT COUNT(*) AS c FROM quiz_questions").get().c;
  if (n > 0) {
    db.exec("DELETE FROM quiz_answers");
    db.exec("DELETE FROM quiz_questions");
  }

  const ins = db.prepare(
    `INSERT INTO quiz_questions (question, hint, min_chars, is_active, order_num) VALUES (?, ?, ?, 1, ?)`
  );
  AWARENESS_QUESTIONS.forEach((q, i) => ins.run(q.question, q.hint, q.min_chars, i));
}

module.exports = { migrateSchema, AWARENESS_QUESTIONS };
