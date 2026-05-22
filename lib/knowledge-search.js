const { tokenize, matchedTokenCount } = require("./rag-search");

function scoreDocument(text, tokens) {
  if (!tokens.length) return 0;
  const m = matchedTokenCount(text, tokens);
  if (!m) return 0;
  return m * 4 + Math.min(m / tokens.length, 1) * 2;
}

/**
 * بحث موحّد في المعرفة والمكتبة — نفس تطبيع العربية ومرادفات RAG
 */
function searchKnowledge(db, query, limit = 5) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const minScore = Math.max(4, Math.ceil(tokens.length * 3));
  const results = [];

  const articles = db
    .prepare(
      `SELECT id, title, content, category, verified_signature
       FROM knowledge_articles WHERE is_published = 1`
    )
    .all();

  articles.forEach((art) => {
    const hay = `${art.title} ${art.category || ""} ${art.content || ""}`;
    const score = scoreDocument(hay, tokens);
    if (score >= minScore) {
      results.push({
        type: "article",
        id: art.id,
        title: art.title,
        excerpt: excerpt(art.content, tokens),
        signature: art.verified_signature,
        category: art.category,
        score,
        url: `/library/search?q=${encodeURIComponent(art.title || query)}`,
      });
    }
  });

  const videos = db
    .prepare(
      `SELECT v.id, v.title, v.transcript_text, c.name_ar AS category
       FROM videos v
       JOIN library_categories c ON v.category_id = c.id
       WHERE v.is_published = 1`
    )
    .all();

  videos.forEach((vid) => {
    const hay = `${vid.title} ${vid.category || ""} ${vid.transcript_text || ""}`;
    const score = scoreDocument(hay, tokens);
    if (score >= minScore) {
      results.push({
        type: "video",
        id: vid.id,
        title: vid.title,
        excerpt: excerpt(vid.transcript_text, tokens),
        category: vid.category,
        score,
        url: `/library/video/${vid.id}`,
      });
    }
  });

  const segments = db
    .prepare(
      `SELECT s.text, s.start_seconds, v.title, v.id AS video_id
       FROM video_transcript_segments s
       JOIN videos v ON s.video_id = v.id
       WHERE v.is_published = 1`
    )
    .all();

  segments.forEach((seg) => {
    const score = scoreDocument(`${seg.title} ${seg.text}`, tokens);
    if (score >= minScore + 2) {
      const m = Math.floor(seg.start_seconds / 60);
      const s = Math.floor(seg.start_seconds % 60);
      results.push({
        type: "segment",
        id: seg.video_id,
        title: seg.title,
        excerpt: seg.text.length > 220 ? seg.text.slice(0, 220) + "…" : seg.text,
        timestamp: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        score,
        url: `/library/video/${seg.video_id}`,
      });
    }
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

function excerpt(text, tokens, radius = 140) {
  if (!text) return "";
  const norm = text.toLowerCase();
  for (const w of tokens) {
    const idx = norm.indexOf(w);
    if (idx >= 0) {
      let start = Math.max(0, idx - radius);
      let end = Math.min(text.length, idx + w.length + radius);
      let sn = text.slice(start, end).trim();
      if (start > 0) sn = "…" + sn;
      if (end < text.length) sn += "…";
      return sn;
    }
  }
  return text.length > 220 ? text.slice(0, 220) + "…" : text;
}

module.exports = { searchKnowledge, scoreDocument };
