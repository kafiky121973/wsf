/**
 * يولّد ملفات Excel جاهزة في data/library-templates/
 * تشغيل: node scripts/generate-library-templates.js
 */
const fs = require("fs");
const path = require("path");
const { getDb } = require("../lib/db");
const { buildTopicTemplateBuffer, listTopicPacks } = require("../lib/library-excel");

const OUT_DIR = path.join(__dirname, "..", "data", "library-templates");

function loadCategories(db) {
  return db
    .prepare(
      `SELECT c.id, c.slug, c.name_ar, c.level_id, l.name_ar AS level_name, l.level_number
       FROM library_categories c
       JOIN library_levels l ON c.level_id = l.id
       ORDER BY l.level_number, c.sort_order, c.name_ar`
    )
    .all();
}

const db = getDb();
try {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const categories = loadCategories(db);
  listTopicPacks().forEach((pack) => {
    const buf = buildTopicTemplateBuffer(pack.key, categories);
    if (!buf) return;
    const file = path.join(OUT_DIR, `shifra-library-${pack.key}.xlsx`);
    fs.writeFileSync(file, buf);
    console.log("✓", file);
  });
} finally {
  db.close();
}
