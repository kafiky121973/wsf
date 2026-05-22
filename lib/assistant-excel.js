const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { loadRagRows, reloadRag } = require("./rag-search");

const CSV_PATH = path.join(__dirname, "..", "data", "rag_qa_mapping.csv");

const HEADERS = ["id", "title", "stage", "tags", "user_question", "optimized_answer", "slug"];

const STAGES = ["التطهير", "الاستيقاظ", "الاعتصام", "سيادة والإنتاج"];

const SAMPLE_ROWS = [
  [
    "1",
    "فطور التمر والزبدة الفطرية",
    "التطهير",
    "فطور, تمر, زبدة, طاقة",
    "ماذا آكل في الفطور لزيادة الطاقة الفطرية؟",
    "وجبة فطور سيادية تتكون من 3 إلى 5 تمرات أصيلة مع ملعقة من الزبدة الحيوانية الطبيعية المستخرجة من الحليب كامل الدسم بدون إضافات مصنعة. التمر مشحون بالمعادن والألياف والزبدة توفر دهوناً فطرية نقية تغذي الدماغ وتحافظ على استقرار الأنسولين طوال الصباح.",
    "dates-butter-breakfast",
  ],
  [
    "2",
    "معركة الـ40 يوماً",
    "التطهير",
    "تطهير;40يوم;بروتوكول;سيادة",
    "إيه معنى الأربعين يوم وهل هي حمية؟",
    "يا بطل، الأربعون يوماً ليست حمية مؤقتة ولا لعبة سعرات. هي «إعلان سيادة» على جسدك: تقطع فيها كابلات السكر والدقيق والزيوت المهدرجة، وتصوم الشاشات لترميم الدوبامين، وتعود للطيبات.",
    "forty-days",
  ],
];

const HEADER_ALIASES = {
  id: "id",
  title: "title",
  stage: "stage",
  tags: "tags",
  user_question: "user_question",
  optimized_answer: "optimized_answer",
  slug: "slug",
  content: "content",
  category: "category",
  verified_signature: "verified_signature",
  is_published: "is_published",
  العنوان: "title",
  المحتوى: "content",
  التصنيف: "category",
  المرحلة: "stage",
  الوسوم: "tags",
  السؤال: "user_question",
  الجواب: "optimized_answer",
  المعرف: "slug",
  "التوقيع الموثق": "verified_signature",
  نشر: "is_published",
};

const CATEGORY_STAGE = {
  تغذية: "التطهير",
  تطهير: "التطهير",
  استيقاظ: "الاستيقاظ",
  وعي: "الاستيقاظ",
  اعتصام: "الاعتصام",
  سيادة: "سيادة والإنتاج",
  إنتاج: "سيادة والإنتاج",
};

function cell(v) {
  if (v == null) return "";
  return String(v).trim();
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows) {
  const lines = [HEADERS.join(",")];
  rows.forEach((r) => {
    lines.push(HEADERS.map((h) => csvEscape(r[h] ?? "")).join(","));
  });
  return lines.join("\n") + "\n";
}

function writeRagCsv(rows) {
  const sorted = [...rows].sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
  fs.mkdirSync(path.dirname(CSV_PATH), { recursive: true });
  fs.writeFileSync(CSV_PATH, "\uFEFF" + rowsToCsv(sorted), "utf8");
  reloadRag();
}

function decorateSheet(ws) {
  if (!ws["!ref"]) return ws;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: range.e.r, c: HEADERS.length - 1 },
    }),
  };
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  return ws;
}

function buildInstructionsAoa() {
  return [
    ["قالب بيانات المساعد — جدول rag_qa_mapping"],
    [""],
    ["الأعمدة (لا تغيّر أسماء الصف الأول):"],
    [HEADERS.join(" , ")],
    [""],
    ["الحقول:"],
    ["id — رقم تسلسلي (اتركه فارغاً عند الإضافة ليُولَّد تلقائياً)"],
    ["title — عنوان الموضوع"],
    ["stage — المرحلة: التطهير | الاستيقاظ | الاعتصام | سيادة والإنتاج"],
    ["tags — وسوم مفصولة بفاصلة أو فاصلة منقوطة"],
    ["user_question — سؤال المستخدم النموذجي"],
    ["optimized_answer — الجواب الذي يعرضه المساعد"],
    ["slug — معرف فريد بالإنجليزية (بدون مسافات)"],
    [""],
    ["بعد الرفع يُحدَّث الملف: data/rag_qa_mapping.csv"],
  ];
}

function existingDataRows() {
  const rows = loadRagRows();
  if (!rows.length) return SAMPLE_ROWS;
  return rows.map((r) =>
    HEADERS.map((h) => {
      if (h === "id") return r.id || "";
      return r[h] || "";
    })
  );
}

function buildTemplateBuffer() {
  const wb = XLSX.utils.book_new();

  const wsInst = XLSX.utils.aoa_to_sheet(buildInstructionsAoa());
  wsInst["!cols"] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInst, "تعليمات");

  const dataAoa = [HEADERS, ...existingDataRows()];
  const ws = decorateSheet(XLSX.utils.aoa_to_sheet(dataAoa));
  ws["!cols"] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 16 },
    { wch: 24 },
    { wch: 40 },
    { wch: 60 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "assistant_qa");

  const wsStages = XLSX.utils.aoa_to_sheet([
    ["stage", "ملاحظة"],
    ...STAGES.map((s) => [s, "قيمة مسموحة في عمود stage"]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsStages, "stages");

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

function slugifyAscii(text) {
  return String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function makeUniqueSlug(preferred, used, lineNum) {
  let base = slugifyAscii(preferred);
  if (!base || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(base)) base = `topic-${lineNum}`;
  let slug = base.toLowerCase();
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n++}`;
  }
  used.add(slug);
  return slug;
}

function mapStage(value) {
  const v = cell(value);
  if (STAGES.includes(v)) return v;
  const lower = v.toLowerCase();
  for (const [hint, stage] of Object.entries(CATEGORY_STAGE)) {
    if (lower.includes(hint)) return stage;
  }
  return "التطهير";
}

function detectSheetFormat(wb, sheetName) {
  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: false });
  if (!raw.length) return { format: "unknown", raw: [] };
  const keys = new Set();
  Object.keys(raw[0]).forEach((k) => {
    const mapped = HEADER_ALIASES[String(k).trim()];
    if (mapped) keys.add(mapped);
  });
  if (keys.has("user_question") && keys.has("optimized_answer")) return { format: "qa", raw };
  if (keys.has("content")) return { format: "knowledge", raw };
  if (keys.has("title") && keys.has("optimized_answer")) return { format: "qa", raw };
  return { format: "unknown", raw };
}

function findQaSheet(names, wb) {
  const ranked = names
    .filter((n) => !/^تعليمات$|^stages$/i.test(n))
    .map((name) => {
      const { format } = detectSheetFormat(wb, name);
      let score = 0;
      if (format === "qa") score = 100;
      else if (format === "knowledge") score = 80;
      else if (/^assistant_qa$/i.test(name)) score = 60;
      else if (/rag|مساعد|qa|معرفة|knowledge/i.test(name)) score = 40;
      else score = 10;
      return { name, format, score };
    })
    .sort((a, b) => b.score - a.score);
  return ranked[0] || null;
}

function mapRow(rawRow) {
  const mapped = {};
  Object.entries(rawRow).forEach(([k, v]) => {
    const key = HEADER_ALIASES[String(k).trim()];
    if (key) mapped[key] = v;
  });
  return mapped;
}

function isHeaderDuplicateRow(m) {
  return cell(m.slug) === "slug" || cell(m.user_question) === "user_question";
}

function parseQaRows(raw, errors) {
  const rows = [];
  raw.forEach((rawRow, idx) => {
    const line = idx + 2;
    const m = mapRow(rawRow);
    if (isHeaderDuplicateRow(m)) return;

    const title = cell(m.title);
    const user_question = cell(m.user_question);
    const optimized_answer = cell(m.optimized_answer);
    let slug = cell(m.slug);

    if (!title && !user_question && !optimized_answer && !slug) return;

    if (!title || !user_question || !optimized_answer) {
      errors.push(`صف ${line}: title و user_question و optimized_answer مطلوبة.`);
      return;
    }

    const used = new Set(rows.map((r) => r.slug));
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
      slug = makeUniqueSlug(title, used, line);
    } else {
      slug = slug.toLowerCase();
    }

    rows.push({
      id: cell(m.id),
      title,
      stage: cell(m.stage) || "التطهير",
      tags: cell(m.tags),
      user_question,
      optimized_answer,
      slug,
    });
  });
  return rows;
}

function parseKnowledgeRows(raw, errors) {
  const rows = [];
  const articles = [];
  const usedSlugs = new Set(loadRagRows().map((r) => r.slug));

  raw.forEach((rawRow, idx) => {
    const line = idx + 2;
    const m = mapRow(rawRow);
    const title = cell(m.title);
    const content = cell(m.content) || cell(m.optimized_answer);

    if (!title && !content) return;
    if (!title || !content) {
      errors.push(`صف ${line}: العنوان والمحتوى مطلوبان.`);
      return;
    }

    const slug = makeUniqueSlug(cell(m.slug) || title, usedSlugs, rows.length + 1);
    const user_question =
      cell(m.user_question) || (title.endsWith("؟") ? title : `ما المقصود بـ ${title}؟`);

    rows.push({
      id: cell(m.id),
      title,
      stage: mapStage(m.stage || m.category),
      tags: cell(m.tags),
      user_question,
      optimized_answer: content,
      slug,
    });

    articles.push({
      title,
      content,
      category: cell(m.category) || "عام",
      tags: cell(m.tags),
      verified_signature: cell(m.verified_signature),
      is_published: parsePublished(m.is_published),
    });
  });

  return { rows, articles };
}

function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const picked = findQaSheet(wb.SheetNames, wb);
  if (!picked) return { rows: [], errors: ["لا توجد ورقة بيانات صالحة."], format: "unknown", articles: [] };

  const { format, raw } = detectSheetFormat(wb, picked.name);
  const errors = [];
  let rows = [];
  let articles = [];

  if (format === "knowledge") {
    ({ rows, articles } = parseKnowledgeRows(raw, errors));
  } else if (format === "qa" || picked.format === "qa") {
    rows = parseQaRows(raw, errors);
  } else {
    rows = parseQaRows(raw, errors);
    if (!rows.length) {
      ({ rows, articles } = parseKnowledgeRows(raw, errors));
    }
  }

  if (!rows.length && !errors.length) {
    errors.push("لم تُعثر على صفوف صالحة — استخدم قالب المساعد أو قالب المعرفة (العنوان + المحتوى).");
  }

  return {
    rows,
    errors,
    format: articles.length ? "knowledge" : format === "knowledge" ? "knowledge" : "qa",
    articles,
    sheetName: picked.name,
  };
}

function mergeImportRows(newRows, mode = "merge") {
  const existing = loadRagRows();
  const bySlug = new Map(existing.map((r) => [r.slug, { ...r }]));
  let nextId = existing.reduce((max, r) => Math.max(max, parseInt(r.id, 10) || 0), 0);

  newRows.forEach((r) => {
    if (!bySlug.has(r.slug)) {
      nextId += 1;
      bySlug.set(r.slug, { ...r, id: String(r.id || nextId) });
    } else if (mode === "merge") {
      const prev = bySlug.get(r.slug);
      bySlug.set(r.slug, {
        ...prev,
        ...r,
        id: r.id || prev.id,
      });
    } else {
      bySlug.set(r.slug, { ...r, id: r.id || bySlug.get(r.slug).id });
    }
  });

  const merged = Array.from(bySlug.values()).map((r, i) => ({
    id: String(r.id || i + 1),
    title: r.title,
    stage: r.stage,
    tags: r.tags,
    user_question: r.user_question,
    optimized_answer: r.optimized_answer,
    slug: r.slug,
  }));

  writeRagCsv(merged);
  return { count: merged.length, imported: newRows.length };
}

function replaceImportRows(newRows) {
  const withIds = newRows.map((r, i) => ({
    ...r,
    id: String(r.id || i + 1),
  }));
  writeRagCsv(withIds);
  return { count: withIds.length, imported: withIds.length };
}

function updateQaRow(oldSlug, data) {
  const rows = loadRagRows(true);
  const idx = rows.findIndex((r) => r.slug === oldSlug);
  if (idx < 0) return { ok: false, error: "not_found" };

  const newSlug = String(data.slug || oldSlug).trim().toLowerCase();
  if (newSlug !== oldSlug && rows.some((r) => r.slug === newSlug)) {
    return { ok: false, error: "slug_taken" };
  }

  rows[idx] = {
    id: String(data.id || rows[idx].id),
    title: data.title,
    stage: data.stage || rows[idx].stage || "التطهير",
    tags: data.tags || "",
    user_question: data.user_question,
    optimized_answer: data.optimized_answer,
    slug: newSlug,
  };

  writeRagCsv(rows);
  return { ok: true, slug: newSlug };
}

module.exports = {
  HEADERS,
  CSV_PATH,
  buildTemplateBuffer,
  parseWorkbook,
  mergeImportRows,
  replaceImportRows,
  updateQaRow,
  writeRagCsv,
  STAGES,
};
