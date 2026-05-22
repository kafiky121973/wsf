"""استجابة استشارية من قاعدة المعرفة — بحث دلالي بسيط (قابل للربط بـ LLM لاحقاً)."""

import json
import re

from app.database import get_db


def search_knowledge(query: str, limit: int = 5) -> list[dict]:
    words = [w for w in re.split(r"\s+", query.strip()) if len(w) > 2]
    if not words:
        return []

    results = []
    with get_db() as conn:
        articles = conn.execute(
            "SELECT id, title, content, category, verified_signature FROM knowledge_articles WHERE is_published = 1"
        ).fetchall()
        videos = conn.execute(
            """SELECT v.id, v.title, v.transcript_text, c.name_ar as category
               FROM videos v JOIN library_categories c ON v.category_id = c.id
               WHERE v.is_published = 1"""
        ).fetchall()
        segments = conn.execute(
            """SELECT s.text, s.start_seconds, s.end_seconds, v.title, v.id as video_id
               FROM video_transcript_segments s JOIN videos v ON s.video_id = v.id"""
        ).fetchall()

    for art in articles:
        score = sum(1 for w in words if w in (art["title"] + art["content"]).lower())
        if score:
            excerpt = _excerpt(art["content"], words)
            results.append({
                "type": "article",
                "id": art["id"],
                "title": art["title"],
                "excerpt": excerpt,
                "signature": art["verified_signature"],
                "score": score,
            })

    for vid in videos:
        text = (vid["title"] or "") + " " + (vid["transcript_text"] or "")
        score = sum(1 for w in words if w in text.lower())
        if score:
            results.append({
                "type": "video",
                "id": vid["id"],
                "title": vid["title"],
                "excerpt": _excerpt(vid["transcript_text"] or "", words),
                "category": vid["category"],
                "score": score,
            })

    for seg in segments:
        score = sum(1 for w in words if w in seg["text"].lower())
        if score:
            results.append({
                "type": "segment",
                "video_id": seg["video_id"],
                "title": seg["title"],
                "excerpt": seg["text"],
                "timestamp": _fmt_time(seg["start_seconds"]),
                "score": score + 1,
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]


def generate_ai_response(question: str) -> str:
    hits = search_knowledge(question, limit=8)
    if not hits:
        return (
            "لم أجد في أرشيف الحصن مرجعاً مباشراً لسؤالك. "
            "سيُحوَّل سؤالك إلى كادر حارس معتمد للرد ببروتوكول فطري موثّق."
        )

    lines = [
        "بناءً على أرشيف شفرة الفطرة (الحصن الرقمي)، إليك ما وثّقه الكوادر:",
        "",
    ]
    for i, h in enumerate(hits, 1):
        sig = f" — [{h['signature']}]" if h.get("signature") else ""
        ts = f" (عند {h['timestamp']})" if h.get("timestamp") else ""
        lines.append(f"{i}. **{h['title']}**{ts}{sig}")
        lines.append(f"   {h['excerpt']}")
        lines.append("")

    lines.append("—")
    lines.append("هذا الرد مُولَّد من قاعدة المعرفة السيادية. للحالات الحرجة، راجع كادراً حارساً معتمداً.")
    return "\n".join(lines)


def _excerpt(text: str, words: list, radius: int = 120) -> str:
    if not text:
        return ""
    lower = text.lower()
    for w in words:
        idx = lower.find(w.lower())
        if idx >= 0:
            start = max(0, idx - radius)
            end = min(len(text), idx + len(w) + radius)
            snippet = text[start:end].strip()
            if start > 0:
                snippet = "…" + snippet
            if end < len(text):
                snippet = snippet + "…"
            return snippet
    return text[:200] + ("…" if len(text) > 200 else "")


def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"
