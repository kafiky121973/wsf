const { loadRagRows, sourceUrlFor } = require("./rag-search");

function excerpt(text, max = 280) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).trim() + "…";
}

function formatDoseBody(lead, body, sourceLabel) {
  const parts = [];
  if (lead) parts.push(lead);
  if (body) parts.push(body);
  parts.push(`— من ${sourceLabel} · شفرة الفطرة`);
  return parts.join("\n\n");
}

function recentSourceRefs(db, limit = 20) {
  try {
    return db
      .prepare(
        `SELECT source_ref FROM newsletters
         WHERE source_ref IS NOT NULL AND source_ref != ''
         ORDER BY COALESCE(sent_at, created_at) DESC LIMIT ?`
      )
      .all(limit)
      .map((r) => r.source_ref);
  } catch {
    return [];
  }
}

function collectCandidates(db) {
  const candidates = [];

  loadRagRows().forEach((row) => {
    const answer = row.optimized_answer || row.answer;
    if (!answer || answer.length < 40) return;
    const title = row.title || row.user_question || "جرعة وعي";
    candidates.push({
      source_type: "assistant",
      source_ref: `rag:${row.id || ""}:${row.slug || ""}`,
      subject: `جرعة وعي — ${excerpt(title, 55)}`,
      content: formatDoseBody(
        row.user_question ? `◆ ${excerpt(row.user_question, 120)}` : null,
        excerpt(answer, 320),
        "مساعدك — أرشيف المعرفة"
      ),
      link_url: sourceUrlFor(row),
    });
  });

  try {
    db.prepare(
      `SELECT v.id, v.title, v.description, v.transcript_text, c.name_ar AS category
       FROM videos v
       JOIN library_categories c ON v.category_id = c.id
       WHERE v.is_published = 1`
    )
      .all()
      .forEach((v) => {
        const text = v.transcript_text || v.description;
        if (!text || text.length < 40) return;
        candidates.push({
          source_type: "library",
          source_ref: `video:${v.id}`,
          subject: `جرعة وعي — ${excerpt(v.title, 55)}`,
          content: formatDoseBody(
            v.category ? `◆ ${v.category}` : null,
            excerpt(text, 320),
            "مكتبة الوعي"
          ),
          link_url: `/library/video/${v.id}`,
        });
      });

    db.prepare(
      `SELECT s.text, s.start_seconds, v.id AS video_id, v.title
       FROM video_transcript_segments s
       JOIN videos v ON s.video_id = v.id
       WHERE v.is_published = 1 AND length(s.text) >= 50`
    )
      .all()
      .forEach((s) => {
        candidates.push({
          source_type: "library_segment",
          source_ref: `seg:${s.video_id}:${Math.floor(s.start_seconds)}`,
          subject: `جرعة وعي — ${excerpt(s.title, 45)}`,
          content: formatDoseBody(
            `◆ ${s.title}`,
            excerpt(s.text, 300),
            "مكتبة الوعي"
          ),
          link_url: `/library/video/${s.video_id}`,
        });
      });

    db.prepare(
      `SELECT id, title, content, category FROM knowledge_articles WHERE is_published = 1`
    )
      .all()
      .forEach((a) => {
        if (!a.content || a.content.length < 40) return;
        candidates.push({
          source_type: "knowledge",
          source_ref: `article:${a.id}`,
          subject: `جرعة وعي — ${excerpt(a.title, 55)}`,
          content: formatDoseBody(
            a.category ? `◆ ${a.category}` : null,
            excerpt(a.content, 320),
            "أرشيف المعرفة"
          ),
          link_url: `/cadres/knowledge?q=${encodeURIComponent(a.title)}`,
        });
      });
  } catch (_) {
    /* جداول قد تكون ناقصة */
  }

  return candidates;
}

function pickDose(db) {
  const recent = new Set(recentSourceRefs(db));
  const pool = collectCandidates(db).filter((c) => !recent.has(c.source_ref));
  const list = pool.length ? pool : collectCandidates(db);
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function previewNextDose(db) {
  return pickDose(db);
}

module.exports = { pickDose, previewNextDose, excerpt, collectCandidates };
