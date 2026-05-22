const crypto = require("crypto");

const TOKEN_TYPES = {
  EMAIL_VERIFY: "email_verify",
  PASSWORD_RESET: "password_reset",
};

/** تأكيد البريد: بالضغط على الرابط فقط — لا تفعيل تلقائي */
const EMAIL_VERIFY_TTL_MINUTES = parseInt(process.env.EMAIL_VERIFY_TTL_MINUTES || "30", 10);

const TTL = {
  email_verify: { minutes: EMAIL_VERIFY_TTL_MINUTES },
  password_reset: { hours: 2 },
};

function ttlMs(type) {
  const t = TTL[type];
  if (t?.minutes) return t.minutes * 60 * 1000;
  if (t?.hours) return t.hours * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

function generateRawToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createAuthToken(db, userId, type) {
  const raw = generateRawToken();
  const now = Date.now();
  let ms = ttlMs(type);
  if (type === TOKEN_TYPES.EMAIL_VERIFY && db) {
    try {
      const { getAppConfig } = require("./app-config");
      const min = parseInt(getAppConfig(db).cfg.EMAIL_VERIFY_TTL_MINUTES || EMAIL_VERIFY_TTL_MINUTES, 10);
      if (Number.isFinite(min) && min > 0) ms = min * 60 * 1000;
    } catch (_) {
      /* ignore */
    }
  }
  const expiresAt = new Date(now + ms).toISOString();
  const createdAt = new Date(now).toISOString();
  db.prepare(
    `INSERT INTO auth_tokens (user_id, type, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, type, hashToken(raw), expiresAt, createdAt);
  return raw;
}

function findValidToken(db, rawToken, type) {
  if (!rawToken) return null;
  const row = db
    .prepare(
      `SELECT t.*, u.email, u.full_name, u.status
       FROM auth_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.type = ? AND t.used_at IS NULL AND t.expires_at > ?`
    )
    .get(hashToken(rawToken), type, new Date().toISOString());
  return row || null;
}

function consumeToken(db, tokenId) {
  db.prepare(`UPDATE auth_tokens SET used_at = ? WHERE id = ?`).run(new Date().toISOString(), tokenId);
}

function invalidateTokensForUser(db, userId, type) {
  db.prepare(
    `UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND type = ? AND used_at IS NULL`
  ).run(new Date().toISOString(), userId, type);
}

module.exports = {
  TOKEN_TYPES,
  EMAIL_VERIFY_TTL_MINUTES,
  createAuthToken,
  findValidToken,
  consumeToken,
  invalidateTokensForUser,
};
