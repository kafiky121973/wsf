const crypto = require("crypto");
const session = require("express-session");
const { createDatabase } = require("./sqlite-driver");
const { loadDatabaseConfig } = require("./database-config");
const path = require("path");

/** حفظ تسجيل الدخول — سنة (كوكي + قاعدة الجلسات) */
const SESSION_REMEMBER_MS = 365 * 24 * 60 * 60 * 1000;
/** بدون «حفظ الدخول» — جلسة المتصفح فقط (تنظيف السيرفر بعد 48 ساعة) */
const SESSION_BROWSER_STORE_MS = 48 * 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = SESSION_REMEMBER_MS;

function cookieSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

function cookieOptions(remember = true) {
  const opts = {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
  };
  if (remember) opts.maxAge = SESSION_REMEMBER_MS;
  return opts;
}

function sessionRemembered(sess) {
  return sess && sess.rememberMe !== false;
}

function applyPersistentCookie(sess, remember) {
  if (!sess) return;
  const keep = remember === undefined ? sessionRemembered(sess) : !!remember;
  sess.rememberMe = keep;
  if (!sess.cookie) sess.cookie = {};
  const opts = cookieOptions(keep);
  sess.cookie.httpOnly = opts.httpOnly;
  sess.cookie.sameSite = opts.sameSite;
  sess.cookie.secure = opts.secure;
  sess.cookie.path = opts.path;
  if (keep) {
    sess.cookie.maxAge = opts.maxAge;
    sess.cookie.expires = new Date(Date.now() + opts.maxAge);
  } else {
    delete sess.cookie.maxAge;
    delete sess.cookie.expires;
  }
}

class SqliteSessionStore extends session.Store {
  constructor(dbPath) {
    super();
    this.dbPath = dbPath;
    this.db = null;
  }

  _ensure() {
    if (this.db) return;
    this.db = createDatabase(this.dbPath);
    try {
      this.db.pragma("journal_mode = WAL");
    } catch (_) {
      /* sql.js قد لا يدعم WAL */
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
    `);
    this._get = this.db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expire > ?");
    this._set = this.db.prepare(
      "INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire"
    );
    this._destroy = this.db.prepare("DELETE FROM sessions WHERE sid = ?");
    this._clearExpired = this.db.prepare("DELETE FROM sessions WHERE expire <= ?");
  }

  get(sid, cb) {
    try {
      this._ensure();
      this._clearExpired.run(Date.now());
      const row = this._get.get(sid, Date.now());
      if (!row) return cb(null, null);
      const sess = JSON.parse(row.sess);
      applyPersistentCookie(sess);
      cb(null, sess);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this._ensure();
      const keep = sessionRemembered(sess);
      applyPersistentCookie(sess, keep);
      const expire = Date.now() + (keep ? SESSION_REMEMBER_MS : SESSION_BROWSER_STORE_MS);
      this._set.run(sid, JSON.stringify(sess), expire);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this._ensure();
      this._destroy.run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sess, cb) {
    this.set(sid, sess, cb);
  }
}

function resolveSessionSecret() {
  if (process.env.SECRET_KEY && process.env.SECRET_KEY.length >= 16) {
    return process.env.SECRET_KEY;
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[session] SECRET_KEY غير معيّن في .env — الجلسات ستُبطل عند كل إعادة تشغيل. عيّن: openssl rand -hex 32"
    );
    return crypto.randomBytes(32).toString("hex");
  }
  return "shifra-fitra-dev-key";
}

class MysqlSessionStore extends session.Store {
  constructor() {
    super();
    this._ready = false;
  }

  _ensure() {
    if (this._ready) return;
    const { getDb } = require("./db");
    const { isMysqlDb } = require("./sql-dialect");
    this.db = getDb();
    const upsert = isMysqlDb(this.db)
      ? `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE sess = VALUES(sess), expire = VALUES(expire)`
      : `INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire`;
    this._get = this.db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expire > ?");
    this._set = this.db.prepare(upsert);
    this._destroy = this.db.prepare("DELETE FROM sessions WHERE sid = ?");
    this._clearExpired = this.db.prepare("DELETE FROM sessions WHERE expire <= ?");
    this._ready = true;
  }

  get(sid, cb) {
    try {
      this._ensure();
      this._clearExpired.run(Date.now());
      const row = this._get.get(sid, Date.now());
      if (!row) return cb(null, null);
      const sess = JSON.parse(row.sess);
      applyPersistentCookie(sess);
      cb(null, sess);
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this._ensure();
      const keep = sessionRemembered(sess);
      applyPersistentCookie(sess, keep);
      const expire = Date.now() + (keep ? SESSION_REMEMBER_MS : SESSION_BROWSER_STORE_MS);
      this._set.run(sid, JSON.stringify(sess), expire);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      this._ensure();
      this._destroy.run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sess, cb) {
    this.set(sid, sess, cb);
  }
}

function createSessionMiddleware() {
  const cfg = loadDatabaseConfig();
  const store =
    cfg.driver === "mysql"
      ? new MysqlSessionStore()
      : new SqliteSessionStore(path.join(__dirname, "..", "data", "shifra.db"));
  return session({
    secret: resolveSessionSecret(),
    name: "shifra.sid",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store,
    cookie: cookieOptions(true),
  });
}

/** بعد تعيين userId — يضمن حفظ الكوكي قبل إعادة التوجيه */
function saveSession(req, remember) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    if (remember !== undefined) req.session.rememberMe = !!remember;
    applyPersistentCookie(req.session, req.session.rememberMe !== false);
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function clearSessionCookie(res) {
  const base = { path: "/", httpOnly: true, sameSite: "lax", secure: cookieSecure() };
  res.clearCookie("shifra.sid", { ...base, maxAge: 0 });
}

module.exports = {
  createSessionMiddleware,
  SESSION_MAX_AGE_MS,
  SESSION_REMEMBER_MS,
  saveSession,
  clearSessionCookie,
  applyPersistentCookie,
};
