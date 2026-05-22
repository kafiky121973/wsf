import sqlite3
from contextlib import contextmanager
from datetime import datetime

from config import DATABASE_PATH


def get_connection():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript(SCHEMA)
        _seed_if_empty(conn)


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'pending',
    status TEXT NOT NULL DEFAULT 'pending',
    pledge_accepted_at TEXT,
    quiz_passed_at TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,
    created_at TEXT NOT NULL,
    last_login TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    resource TEXT NOT NULL,
    can_read INTEGER NOT NULL DEFAULT 0,
    can_write INTEGER NOT NULL DEFAULT 0,
    can_delete INTEGER NOT NULL DEFAULT 0,
    UNIQUE(role, resource)
);

CREATE TABLE IF NOT EXISTS theme_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT,
    updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sovereignty_statement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    order_num INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS library_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_number INTEGER NOT NULL UNIQUE,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    icon TEXT
);

CREATE TABLE IF NOT EXISTS library_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level_id INTEGER NOT NULL REFERENCES library_levels(id),
    name_ar TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES library_categories(id),
    title TEXT NOT NULL,
    description TEXT,
    video_path TEXT,
    thumbnail_path TEXT,
    duration_seconds INTEGER DEFAULT 0,
    transcript_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS video_transcript_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    start_seconds REAL NOT NULL,
    end_seconds REAL NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT,
    content TEXT NOT NULL,
    food_log TEXT,
    health_notes TEXT,
    obstacles TEXT,
    mood TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS community_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    post_type TEXT NOT NULL DEFAULT 'testimony',
    title TEXT,
    content TEXT NOT NULL,
    media_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    review_note TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cadre_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    specialty TEXT NOT NULL,
    bio TEXT,
    fitra_exam_passed INTEGER DEFAULT 0,
    verified_signature TEXT,
    is_available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags TEXT,
    verified_signature TEXT,
    is_published INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS consultations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES users(id),
    question TEXT NOT NULL,
    ai_response TEXT,
    cadre_id INTEGER REFERENCES users(id),
    cadre_response TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    answered_at TEXT
);

CREATE TABLE IF NOT EXISTS distribution_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    lat REAL,
    lng REAL,
    contact_phone TEXT,
    contact_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    items_json TEXT NOT NULL,
    notes TEXT,
    distribution_point_id INTEGER REFERENCES distribution_points(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    fulfilled_at TEXT
);

CREATE TABLE IF NOT EXISTS newsletters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    sent_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
);
"""


def _seed_if_empty(conn):
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
        return

    from werkzeug.security import generate_password_hash

    now = datetime.utcnow().isoformat()
    admin_hash = generate_password_hash("admin123")
    designer_hash = generate_password_hash("designer123")

    conn.execute(
        """INSERT INTO users (username, email, password_hash, full_name, role, status, created_at, approved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        ("admin", "admin@shifra.local", admin_hash, "مدير الحصن", "admin", "active", now, now),
    )
    conn.execute(
        """INSERT INTO users (username, email, password_hash, full_name, role, status, created_at, approved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        ("designer", "designer@shifra.local", designer_hash, "مصمم الشفرة", "designer", "active", now, now),
    )

    default_perms = [
        ("admin", "users", 1, 1, 1),
        ("admin", "permissions", 1, 1, 1),
        ("admin", "library", 1, 1, 1),
        ("admin", "community", 1, 1, 1),
        ("admin", "cadres", 1, 1, 1),
        ("admin", "market", 1, 1, 1),
        ("admin", "newsletter", 1, 1, 1),
        ("admin", "theme", 1, 1, 1),
        ("supervisor", "community", 1, 1, 0),
        ("supervisor", "users", 1, 1, 0),
        ("supervisor", "library", 1, 0, 0),
        ("designer", "theme", 1, 1, 0),
        ("cadre", "consultations", 1, 1, 0),
        ("cadre", "knowledge", 1, 1, 0),
        ("member", "library", 1, 0, 0),
        ("member", "community", 1, 1, 0),
        ("member", "journals", 1, 1, 0),
        ("member", "market", 1, 1, 0),
        ("member", "consultations", 1, 1, 0),
    ]
    for role, resource, r, w, d in default_perms:
        conn.execute(
            """INSERT OR IGNORE INTO role_permissions (role, resource, can_read, can_write, can_delete)
               VALUES (?, ?, ?, ?, ?)""",
            (role, resource, r, w, d),
        )

    theme_defaults = {
        "site_name": "شفرة الفطرة",
        "site_subtitle": "The Blueprint — الحصن الرقمي",
        "primary_color": "#C9A227",
        "secondary_color": "#1A1510",
        "accent_color": "#8B6914",
        "background_gradient": "linear-gradient(135deg, #0D0B08 0%, #1A1510 50%, #2A2218 100%)",
        "font_family": "'Amiri', 'Segoe UI', serif",
        "hero_tagline": "الحصن الرقمي لمن قرر التمرد على المنظومة",
        "logo_text": "شفرة الفطرة",
    }
    for key, value in theme_defaults.items():
        conn.execute(
            "INSERT OR IGNORE INTO theme_settings (key, value, updated_at) VALUES (?, ?, ?)",
            (key, value, now),
        )

    conn.execute(
        """INSERT INTO sovereignty_statement (version, title, content, is_active, created_at)
           VALUES (1, 'بيان استرداد السيادة',
           'أقرّ بأنني أقبل الدخول إلى حصن شفرة الفطرة بجدية تامة، لا للتسلية ولا للتجريب السطحي.
أتعهد بالالتزام بمنهج التطهير والبناء والوعي، واحترام قواعد المجتمع المغلق.
أفهم أن العضوية هبة وليست حقاً مفتوحاً، وأن الرقباء يحق لهم رفض أو إيقاف عضويتي عند مخالفة هذا الإقرار.',
           1, ?)""",
        (now,),
    )

    quiz_data = [
        ("ما الهدف الأساسي من مرحلة التطهير الـ40 يوماً؟", '["التسلية","قطع السكر والدقيق والزيوت المصنعة","زيادة الوزن","مشاهدة فيديوهات فقط"]', 1),
        ("ماذا يعني «الأرض الصلبة» في سجل الإنجاز؟", '["منشورات عامة","توثيق حسي وعلمي للتشافي","إعلانات تجارية","لا شيء"]', 1),
        ("من يراجع شهادات الأعضاء قبل النشر؟", '["أي زائر","الرقباء المؤهلون","خوارزمية يوتيوب","لا أحد"]', 1),
    ]
    for i, (q, opts, correct) in enumerate(quiz_data):
        conn.execute(
            "INSERT INTO quiz_questions (question, options_json, correct_index, order_num) VALUES (?, ?, ?, ?)",
            (q, opts, correct, i),
        )

    levels = [
        (1, "مرحلة التطهير", "Purification", "الـ40 يوماً، تنظيف الجسد، قطع السكر والدقيق والزيوت ومنتجات المصانع", "🜂"),
        (2, "مرحلة بناء الهاردوير", "Hardware Build", "بناء الجسد بالطيبات، أنظمة التغذية، والرياضة الفطرية", "⚔"),
        (3, "مرحلة استرداد الوعي", "Consciousness Recovery", "تدبر القرآن، سجدات التحرر، وفك شفرات المنظومة النفسية", "☪"),
    ]
    for num, ar, en, desc, icon in levels:
        conn.execute(
            "INSERT INTO library_levels (level_number, name_ar, name_en, description, icon) VALUES (?, ?, ?, ?, ?)",
            (num, ar, en, desc, icon),
        )

    categories = [
        (1, "الأربعون يوماً", "forty-days", "منهج التطهير الكامل"),
        (1, "قطع السموم الغذائية", "cut-toxins", "السكر، الدقيق، الزيوت، المصانع"),
        (2, "الطيبات والتغذية", "tayyibat", "بناء الجسد بالحلال الطيب"),
        (2, "الرياضة الفطرية", "fitra-sport", "حركة الجسد على الفطرة"),
        (3, "تدبر القرآن", "quran-tadabbur", "استرداد الوعي بالكتاب"),
        (3, "سجدات التحرر", "liberation-sujud", "العبادة كتحرر نفسي"),
        (3, "شفرات المنظومة", "system-codes", "فك التلاعب النفسي"),
    ]
    for level_id, name, slug, desc in categories:
        conn.execute(
            "INSERT INTO library_categories (level_id, name_ar, slug, description) VALUES (?, ?, ?, ?)",
            (level_id, name, slug, desc),
        )

    now_str = now
    sample_videos = [
        (2, "خطورة السكر على الفطرة", "شرح علمي لأضرار السكر...", 600,
         "السكر يدمر الخلايا. يجب قطع السكر تدريجياً خلال الأربعين يوماً. البدائل الطبيعية من التمر والعسل الخام باعتدال."),
        (2, "كيف تقطع الدقيق الأبيض", "بروتوكول عملي...", 480,
         "الدقيق الأبيض يسبب ارتفاع الإنسولين. استبدله بالحبوب الكاملة بعد التطهير."),
    ]
    for cat_id, title, desc, dur, transcript in sample_videos:
        cur = conn.execute(
            """INSERT INTO videos (category_id, title, description, duration_seconds, transcript_text, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (cat_id, title, desc, dur, transcript, now_str),
        )
        vid_id = cur.lastrowid
        segments = [
            (0, 120, "السكر يدمر الخلايا ويُسبب الالتهاب المزمن."),
            (120, 300, "يجب قطع السكر تدريجياً خلال الأربعين يوماً."),
            (300, 600, "البدائل الطبيعية: التمر والعسل الخام باعتدال."),
        ] if "السكر" in title else [
            (0, 240, "الدقيق الأبيض يرفع الإنسولين بسرعة."),
            (240, 480, "استبدله بالحبوب الكاملة بعد انتهاء التطهير."),
        ]
        for start, end, text in segments:
            conn.execute(
                """INSERT INTO video_transcript_segments (video_id, start_seconds, end_seconds, text)
                   VALUES (?, ?, ?, ?)""",
                (vid_id, start, end, text),
            )

    conn.execute(
        """INSERT INTO knowledge_articles (author_id, title, content, category, verified_signature, is_published, created_at)
           VALUES (1, 'بروتوكول فطري: قطع السكر', 'المحتوى العلمي الكامل عن قطع السكر وفوائده على الجهاز الهضمي والهرمونات...',
           'تغذية', 'د. الحصن — موثق', 1, ?)""",
        (now_str,),
    )

    conn.execute(
        """INSERT INTO cadre_profiles (user_id, specialty, bio, fitra_exam_passed, verified_signature)
           VALUES (1, 'طب فطري', 'كادر معتمد في بروتوكولات الفطرة', 1, 'د. الحصن')"""
    )

    points = [
        ("محراب الرياض — الشمال", "الرياض", "الرياض", "حي النخيل", 24.7, 46.7),
        ("محراب جدة — الغرب", "مكة", "جدة", "حي الصفا", 21.5, 39.2),
        ("محراب القاهرة", "مصر", "القاهرة", "مدينة نصر", 30.0, 31.3),
    ]
    for name, region, city, addr, lat, lng in points:
        conn.execute(
            """INSERT INTO distribution_points (name, region, city, address, lat, lng, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?)""",
            (name, region, city, addr, lat, lng, now_str),
        )
