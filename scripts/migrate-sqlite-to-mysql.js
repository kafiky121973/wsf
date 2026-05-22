#!/usr/bin/env node
/**
 * نقل البيانات من data/shifra.db (SQLite) إلى MySQL.
 * المتطلبات: data/database.json مضبوط على db_driver=mysql أو متغيرات MYSQL_* في البيئة.
 *
 *   node scripts/migrate-sqlite-to-mysql.js
 */
const path = require("path");
const fs = require("fs");
const { createDatabase } = require("../lib/sqlite-driver");
const { loadDatabaseConfig, mysqlConfigured } = require("../lib/database-config");
const { createMysqlDatabase, ready } = require("../lib/mysql-driver");

const SQLITE_PATH = path.join(__dirname, "..", "data", "shifra.db");

const TABLES = [
  "users",
  "presence_sessions",
  "role_nav_items",
  "role_permissions",
  "theme_settings",
  "sovereignty_statement",
  "quiz_questions",
  "quiz_answers",
  "library_levels",
  "library_categories",
  "videos",
  "video_transcript_segments",
  "journals",
  "community_posts",
  "cadre_profiles",
  "knowledge_articles",
  "consultations",
  "distribution_points",
  "market_products",
  "market_orders",
  "newsletters",
  "push_subscriptions",
  "newsletter_settings",
  "owner_messages",
  "chat_feedback",
  "audit_log",
  "site_settings",
  "sessions",
];

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error("لا يوجد ملف SQLite:", SQLITE_PATH);
    process.exit(1);
  }
  const cfg = loadDatabaseConfig();
  if (cfg.driver !== "mysql" || !mysqlConfigured(cfg)) {
    console.error("اضبط MySQL في /admin/system أو data/database.json (db_driver=mysql) أولاً.");
    process.exit(1);
  }

  await ready();
  const sqlite = createDatabase(SQLITE_PATH);
  sqlite._driver = "sqlite";
  const mysql = createMysqlDatabase();

  const schema = fs.readFileSync(path.join(__dirname, "..", "lib", "schema-mysql.sql"), "utf8");
  mysql.exec(schema);
  const { migrateSchema } = require("../lib/migrate");
  migrateSchema(mysql);

  console.log("نقل الجداول...");
  for (const table of TABLES) {
    let rows = [];
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch (e) {
      console.log(`  تخطي ${table}: ${e.message}`);
      continue;
    }
    if (!rows.length) {
      console.log(`  ${table}: فارغ`);
      continue;
    }
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => "?").join(", ");
    const colList = cols.map((c) => (["key"].includes(c) ? "`key`" : c)).join(", ");
    const ins = mysql.prepare(
      `INSERT IGNORE INTO ${table} (${colList}) VALUES (${placeholders})`
    );
    let n = 0;
    for (const row of rows) {
      ins.run(...cols.map((c) => row[c]));
      n += 1;
    }
    console.log(`  ${table}: ${n} صف`);
  }

  sqlite.close();
  mysql.close();
  console.log("\nتم النقل. أعد تشغيل التطبيق (Redeploy) مع db_driver=mysql.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
