/**
 * إعدادات التطبيق: Environment Variables + site_settings (لوحة الإدارة).
 * قيم لوحة الإدارة تتجاوز البيئة عند حفظها في القاعدة.
 */
const { EMAIL_VERIFY_TTL_MINUTES: DEFAULT_EMAIL_TTL } = require("./auth-tokens");

const DB_KEYS = {
  site_url: "SITE_URL",
  smtp_host: "SMTP_HOST",
  smtp_port: "SMTP_PORT",
  smtp_secure: "SMTP_SECURE",
  smtp_user: "SMTP_USER",
  smtp_pass: "SMTP_PASS",
  mail_from: "MAIL_FROM",
  email_verify_ttl_minutes: "EMAIL_VERIFY_TTL_MINUTES",
};

const FORM_FIELDS = Object.keys(DB_KEYS);

let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 3000;

function fromEnv() {
  return {
    SITE_URL: (process.env.SITE_URL || "").trim(),
    SMTP_HOST: (process.env.SMTP_HOST || "").trim(),
    SMTP_PORT: (process.env.SMTP_PORT || "587").trim(),
    SMTP_SECURE: (process.env.SMTP_SECURE || "false").trim(),
    SMTP_USER: (process.env.SMTP_USER || "").trim(),
    SMTP_PASS: process.env.SMTP_PASS || "",
    MAIL_FROM: (process.env.MAIL_FROM || "").trim(),
    EMAIL_VERIFY_TTL_MINUTES: String(
      process.env.EMAIL_VERIFY_TTL_MINUTES || DEFAULT_EMAIL_TTL
    ).trim(),
  };
}

function loadDbSettings(db) {
  const out = {};
  if (!db) return out;
  try {
    const rows = db.prepare("SELECT key, value FROM site_settings").all();
    for (const r of rows) {
      if (FORM_FIELDS.includes(r.key)) out[r.key] = r.value;
    }
  } catch (_) {
    /* table may not exist yet */
  }
  return out;
}

function mergeConfig(db) {
  const cfg = fromEnv();
  const dbVals = loadDbSettings(db);
  const sources = {};
  for (const [dbKey, envKey] of Object.entries(DB_KEYS)) {
    if (dbVals[dbKey] != null && String(dbVals[dbKey]).trim() !== "") {
      cfg[envKey] = String(dbVals[dbKey]).trim();
      sources[envKey] = "admin";
    } else if (cfg[envKey]) {
      sources[envKey] = "env";
    }
  }
  return { cfg, sources, dbVals };
}

function getAppConfig(db) {
  const now = Date.now();
  if (!db && _cache && now - _cacheAt < CACHE_MS) return _cache;
  const merged = mergeConfig(db);
  if (db) {
    _cache = merged;
    _cacheAt = now;
  }
  return merged;
}

function invalidateAppConfigCache() {
  _cache = null;
  _cacheAt = 0;
}

function smtpConfigured(cfg) {
  const c = cfg?.cfg || cfg || fromEnv();
  const host = c.SMTP_HOST || c.smtp_host;
  const user = c.SMTP_USER || c.smtp_user;
  const pass = c.SMTP_PASS || c.smtp_pass;
  return !!(host && user && pass);
}

function siteUrl(cfg) {
  const c = cfg?.cfg || cfg || fromEnv();
  const u = (c.SITE_URL || "").trim().replace(/\/$/, "");
  return u || "http://127.0.0.1:3000";
}

function mailFromDisplay(cfg) {
  const c = cfg?.cfg || cfg || fromEnv();
  const SITE_NAME = "شفرة الفطرة";
  if (c.MAIL_FROM) return c.MAIL_FROM;
  const user = c.SMTP_USER || "noreply@ark4all.com";
  return `"${SITE_NAME}" <${user}>`;
}

function getSettingsForm(db) {
  const { cfg, sources, dbVals } = getAppConfig(db);
  return {
    site_url: cfg.SITE_URL,
    smtp_host: cfg.SMTP_HOST,
    smtp_port: cfg.SMTP_PORT,
    smtp_secure: cfg.SMTP_SECURE === "true" ? "true" : "false",
    smtp_user: cfg.SMTP_USER,
    mail_from: cfg.MAIL_FROM,
    email_verify_ttl_minutes: cfg.EMAIL_VERIFY_TTL_MINUTES,
    smtp_pass_set: !!(dbVals.smtp_pass || process.env.SMTP_PASS),
    sources,
  };
}

function setSetting(db, key, value) {
  const { siteSettingsUpsertSql } = require("./sql-dialect");
  db.prepare(siteSettingsUpsertSql(db)).run(key, String(value));
}

function saveAppSettings(db, body) {
  const siteUrlVal = (body.site_url || "").trim().replace(/\/$/, "");
  if (!siteUrlVal) return { ok: false, error: "رابط الموقع (SITE_URL) مطلوب." };

  setSetting(db, "site_url", siteUrlVal);
  setSetting(db, "smtp_host", (body.smtp_host || "").trim());
  setSetting(db, "smtp_port", (body.smtp_port || "587").trim());
  setSetting(
    db,
    "smtp_secure",
    body.smtp_secure === "true" || body.smtp_secure === "on" ? "true" : "false"
  );
  setSetting(db, "smtp_user", (body.smtp_user || "").trim());
  setSetting(db, "mail_from", (body.mail_from || "").trim());

  const ttl = parseInt(body.email_verify_ttl_minutes || DEFAULT_EMAIL_TTL, 10);
  if (!Number.isFinite(ttl) || ttl < 5 || ttl > 1440) {
    return { ok: false, error: "مدة رابط التأكيد: بين 5 و 1440 دقيقة." };
  }
  setSetting(db, "email_verify_ttl_minutes", String(ttl));

  const pass = (body.smtp_pass || "").trim();
  if (pass) setSetting(db, "smtp_pass", pass);

  invalidateAppConfigCache();
  return { ok: true };
}

function clearAppSettings(db) {
  const del = db.prepare("DELETE FROM site_settings WHERE key = ?");
  for (const k of FORM_FIELDS) del.run(k);
  invalidateAppConfigCache();
}

module.exports = {
  getAppConfig,
  invalidateAppConfigCache,
  smtpConfigured,
  siteUrl,
  mailFromDisplay,
  getSettingsForm,
  saveAppSettings,
  clearAppSettings,
  FORM_FIELDS,
};
