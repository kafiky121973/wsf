/**
 * تنظيف rag_qa_mapping.csv: id فريد، إزالة تكرار slug، إعادة ترقيم.
 * التشغيل: node scripts/clean-rag-csv.js
 */
const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(__dirname, "..", "data", "rag_qa_mapping.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
      if (ch === "\r") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.length > 1 || row[0]) rows.push(row);
  }
  return rows;
}

function escapeField(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToLine(cells) {
  return cells.map(escapeField).join(",");
}

const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
const table = parseCsv(raw);
const header = table[0].map((h) => String(h || "").trim().replace(/^\uFEFF/, ""));
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const seenSlug = new Set();
const seenQuestion = new Set();
const kept = [];
let skipped = 0;

for (const cells of table.slice(1)) {
  const row = {};
  header.forEach((key, i) => {
    if (key) row[key] = (cells[i] || "").trim();
  });
  if (!row.slug || !row.user_question) {
    skipped++;
    continue;
  }
  const qKey = normalizeKey(row.user_question);
  if (seenSlug.has(row.slug)) {
    skipped++;
    continue;
  }
  if (seenQuestion.has(qKey)) {
    skipped++;
    continue;
  }
  seenSlug.add(row.slug);
  seenQuestion.add(qKey);
  kept.push(row);
}

function normalizeKey(s) {
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

kept.forEach((row, i) => {
  row.id = String(i + 1);
});

const out = [rowToLine(header), ...kept.map((row) => rowToLine(header.map((h) => row[h] || "")))];
fs.writeFileSync(CSV_PATH, out.join("\n") + "\n", "utf8");
console.log(`OK: ${kept.length} rows kept, ${skipped} removed.`);
