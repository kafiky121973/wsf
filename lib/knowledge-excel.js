const XLSX = require("xlsx");

const HEADERS = ["العنوان", "المحتوى", "التصنيف", "الوسوم", "التوقيع الموثق", "نشر"];

const HEADER_MAP = {
  العنوان: "title",
  title: "title",
  المحتوى: "content",
  content: "content",
  التصنيف: "category",
  category: "category",
  الوسوم: "tags",
  tags: "tags",
  "التوقيع الموثق": "verified_signature",
  signature: "verified_signature",
  verified_signature: "verified_signature",
  نشر: "is_published",
  publish: "is_published",
  is_published: "is_published",
};

const SAMPLE_ROWS = [
  [
    "بروتوكول قطع السكر",
    "المحتوى العلمي الكامل عن قطع السكر وفوائده على الجهاز الهضمي والهرمونات…",
    "تغذية",
    "سكر,40يوم,بروتوكول",
    "د. الحصن — موثق",
    "نعم",
  ],
  [
    "بدائل طبيعية للسكر",
    "التمر والعسل الخام باعتدال بعد انتهاء مرحلة التطهير…",
    "تغذية",
    "عسل,تمر",
    "د. الحصن — موثق",
    "نعم",
  ],
];

function buildTemplateBuffer() {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...SAMPLE_ROWS]);
  ws["!cols"] = [{ wch: 28 }, { wch: 50 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "المعرفة");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function parsePublished(val) {
  const s = String(val ?? "")
    .trim()
    .toLowerCase();
  if (!s) return 1;
  if (["نعم", "yes", "y", "1", "true", "منشور", "نشر"].includes(s)) return 1;
  if (["لا", "no", "n", "0", "false", "مسودة"].includes(s)) return 0;
  return 1;
}

function cell(row, key) {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ["الملف فارغ — لا توجد أوراق."] };

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  if (!raw.length) return { rows: [], errors: ["لا توجد صفوف بيانات في الملف."] };

  const rows = [];
  const errors = [];

  raw.forEach((rawRow, idx) => {
    const line = idx + 2;
    const mapped = {};
    Object.entries(rawRow).forEach(([k, v]) => {
      const key = HEADER_MAP[String(k).trim()];
      if (key) mapped[key] = v;
    });

    const title = cell(mapped, "title");
    const content = cell(mapped, "content");
    if (!title && !content) return;
    if (!title || !content) {
      errors.push(`صف ${line}: العنوان والمحتوى مطلوبان.`);
      return;
    }

    rows.push({
      title,
      content,
      category: cell(mapped, "category") || "عام",
      tags: cell(mapped, "tags"),
      verified_signature: cell(mapped, "verified_signature"),
      is_published: parsePublished(mapped.is_published),
    });
  });

  if (!rows.length && !errors.length) {
    errors.push("لم تُعثر على صفوف صالحة — تأكد من استخدام قالب الأعمدة.");
  }

  return { rows, errors };
}

function importRows(db, rows, authorId, defaultSignature) {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO knowledge_articles (author_id, title, content, category, tags, verified_signature, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let imported = 0;
  const insertMany = db.transaction((items) => {
    items.forEach((r) => {
      stmt.run(
        authorId,
        r.title,
        r.content,
        r.category,
        r.tags,
        r.verified_signature || defaultSignature,
        r.is_published,
        now,
        now
      );
      imported += 1;
    });
  });
  insertMany(rows);
  return imported;
}

module.exports = { buildTemplateBuffer, parseWorkbook, importRows, HEADERS };
