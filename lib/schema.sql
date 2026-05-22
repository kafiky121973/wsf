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
    last_login TEXT,
    last_seen_at TEXT,
    admin_stars INTEGER,
    admin_suggestion TEXT,
    admin_rated_at TEXT,
    admin_rated_by INTEGER REFERENCES users(id),
    country TEXT,
    city TEXT,
    district TEXT,
    lat REAL,
    lng REAL,
    location_updated_at TEXT,
    rejected_at TEXT,
    rejection_note TEXT,
    email_verified_at TEXT
);

CREATE TABLE IF NOT EXISTS presence_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS role_nav_items (
    role TEXT NOT NULL,
    item_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (role, item_key)
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
    youtube_url TEXT,
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
    day_number INTEGER,
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
    youtube_url TEXT,
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
    created_at TEXT NOT NULL,
    source_type TEXT,
    source_ref TEXT,
    link_url TEXT,
    auto_generated INTEGER DEFAULT 0
);

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

CREATE TABLE IF NOT EXISTS chat_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    slug TEXT,
    answer_mode TEXT,
    helpful INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
);
