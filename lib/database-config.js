/**
 * إعدادات الاتصال بقاعدة البيانات: SQLite (افتراضي) أو MySQL.
 * تُقرأ من Environment Variables ثم data/database.json (يُحدَّث من /admin/system).
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_PATH = path.join(DATA_DIR, "database.json");

const DB_SETTING_KEYS = [
  "db_driver",
  "mysql_host",
  "mysql_port",
  "mysql_user",
  "mysql_database",
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readFileConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function resolveDriver(file = {}) {
  const raw = (process.env.DB_DRIVER || file.db_driver || "sqlite").toLowerCase();
  return raw === "mysql" ? "mysql" : "sqlite";
}

function loadDatabaseConfig() {
  const file = readFileConfig();
  const driver = resolveDriver(file);
  const mysql = {
    host: (process.env.MYSQL_HOST || file.mysql_host || "127.0.0.1").trim(),
    port: parseInt(process.env.MYSQL_PORT || file.mysql_port || "3306", 10) || 3306,
    user: (process.env.MYSQL_USER || file.mysql_user || "").trim(),
    password: process.env.MYSQL_PASSWORD || process.env.MYSQL_PASS || file.mysql_pass || "",
    database: (process.env.MYSQL_DATABASE || file.mysql_database || "shifra").trim(),
  };
  return { driver, mysql, configPath: CONFIG_PATH };
}

function getDatabaseForm() {
  const file = readFileConfig();
  const cfg = loadDatabaseConfig();
  return {
    db_driver: cfg.driver,
    mysql_host: cfg.mysql.host,
    mysql_port: String(cfg.mysql.port),
    mysql_user: cfg.mysql.user,
    mysql_database: cfg.mysql.database,
    mysql_pass_set: !!(file.mysql_pass || process.env.MYSQL_PASSWORD || process.env.MYSQL_PASS),
    sources: {
      driver: process.env.DB_DRIVER ? "env" : file.db_driver ? "admin" : "default",
      host: process.env.MYSQL_HOST ? "env" : file.mysql_host ? "admin" : "default",
      user: process.env.MYSQL_USER ? "env" : file.mysql_user ? "admin" : "default",
      database: process.env.MYSQL_DATABASE ? "env" : file.mysql_database ? "admin" : "default",
    },
  };
}

function saveDatabaseSettings(body) {
  const driver = (body.db_driver || "sqlite").toLowerCase() === "mysql" ? "mysql" : "sqlite";
  const mysql_host = (body.mysql_host || "").trim();
  const mysql_user = (body.mysql_user || "").trim();
  const mysql_database = (body.mysql_database || "").trim();
  const mysql_port = parseInt(body.mysql_port || "3306", 10);

  if (driver === "mysql") {
    if (!mysql_host) return { ok: false, error: "عنوان خادم MySQL (Host) مطلوب." };
    if (!mysql_user) return { ok: false, error: "اسم مستخدم MySQL مطلوب." };
    if (!mysql_database) return { ok: false, error: "اسم قاعدة البيانات مطلوب." };
    if (!Number.isFinite(mysql_port) || mysql_port < 1 || mysql_port > 65535) {
      return { ok: false, error: "منفذ MySQL غير صالح." };
    }
  }

  ensureDataDir();
  const prev = readFileConfig();
  const next = {
    db_driver: driver,
    mysql_host,
    mysql_port: String(mysql_port || 3306),
    mysql_user,
    mysql_database: mysql_database || "shifra",
    updated_at: new Date().toISOString(),
  };
  const pass = (body.mysql_pass || "").trim();
  if (pass) next.mysql_pass = pass;
  else if (prev.mysql_pass) next.mysql_pass = prev.mysql_pass;

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch (_) {
    /* Windows */
  }

  const { invalidateMysqlPool } = require("./mysql-driver");
  invalidateMysqlPool();

  return {
    ok: true,
    restart_required: true,
    message:
      driver === "mysql"
        ? "تم حفظ إعدادات MySQL. أعد تشغيل التطبيق (Redeploy على Hostinger) لتفعيل الاتصال."
        : "تم الرجوع إلى SQLite. أعد تشغيل التطبيق.",
  };
}

function mysqlConfigured(cfg = loadDatabaseConfig()) {
  if (cfg.driver !== "mysql") return false;
  const m = cfg.mysql;
  return !!(m.host && m.user && m.database);
}

module.exports = {
  loadDatabaseConfig,
  getDatabaseForm,
  saveDatabaseSettings,
  mysqlConfigured,
  readFileConfig,
  CONFIG_PATH,
  DB_SETTING_KEYS,
};
