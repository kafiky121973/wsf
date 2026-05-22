/**
 * تحويلات SQL بين SQLite و MySQL.
 */
function isMysqlDb(db) {
  return db && db._driver === "mysql";
}

function transformSqlForMysql(sql) {
  let s = String(sql || "");
  s = s.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "INT AUTO_INCREMENT PRIMARY KEY");
  s = s.replace(/INSERT OR IGNORE INTO/gi, "INSERT IGNORE INTO");
  s = s.replace(/INSERT OR REPLACE INTO/gi, "REPLACE INTO");
  s = s.replace(
    /ON CONFLICT\s*\(([^)]+)\)\s*DO UPDATE SET\s*([\s\S]+?)(?=;|\s*$)/gi,
    (_, _keys, setClause) => {
      const pairs = setClause.split(",").map((part) => {
        const m = part.trim().match(/(\w+)\s*=\s*excluded\.(\w+)/i);
        if (m) return `${m[1]} = VALUES(${m[2]})`;
        return part.trim();
      });
      return `ON DUPLICATE KEY UPDATE ${pairs.join(", ")}`;
    }
  );
  s = s.replace(/CREATE INDEX IF NOT EXISTS/gi, "CREATE INDEX");
  s = s.replace(/\bTEXT PRIMARY KEY\b/gi, "VARCHAR(191) PRIMARY KEY");
  s = s.replace(/\bTEXT UNIQUE\b/gi, "VARCHAR(191) UNIQUE");
  s = s.replace(/\bTEXT NOT NULL\b/gi, "TEXT NOT NULL");
  s = s.replace(/\bREAL\b/gi, "DOUBLE");
  if (/site_settings|theme_settings|newsletter_settings/i.test(s)) {
    s = s
      .replace(/site_settings\s*\(\s*key\b/gi, "site_settings (`key`")
      .replace(/theme_settings\s*\(\s*key\b/gi, "theme_settings (`key`")
      .replace(/newsletter_settings\s*\(\s*key\b/gi, "newsletter_settings (`key`")
      .replace(/SELECT\s+key\s*,/gi, "SELECT `key`,")
      .replace(/WHERE\s+key\s*=/gi, "WHERE `key` =")
      .replace(/\(key,\s*value\)/gi, "(`key`, value)")
      .replace(/DELETE FROM site_settings WHERE key/gi, "DELETE FROM site_settings WHERE `key`");
  }
  return s;
}

function tableInfo(db, tableName) {
  const t = String(tableName || "").replace(/[^a-zA-Z0-9_]/g, "");
  if (!t) return [];
  if (isMysqlDb(db)) {
    return db
      .prepare(
        `SELECT COLUMN_NAME AS name, DATA_TYPE AS type, IS_NULLABLE AS nullable
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`
      )
      .all(t);
  }
  return db.prepare(`PRAGMA table_info(${t})`).all();
}

function insertIgnore(table, columns) {
  const cols = columns.join(", ");
  const ph = columns.map(() => "?").join(", ");
  if (isMysqlDb({ _driver: "mysql" })) {
    return `INSERT IGNORE INTO ${table} (${cols}) VALUES (${ph})`;
  }
  return `INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${ph})`;
}

function upsertSiteSetting() {
  return `INSERT INTO site_settings (\`key\`, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`;
}

function upsertSiteSettingSqlite() {
  return `INSERT INTO site_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`;
}

function siteSettingsUpsertSql(db) {
  return isMysqlDb(db) ? upsertSiteSetting() : upsertSiteSettingSqlite();
}

module.exports = {
  isMysqlDb,
  transformSqlForMysql,
  tableInfo,
  insertIgnore,
  siteSettingsUpsertSql,
};
