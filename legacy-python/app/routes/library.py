import re

from flask import Blueprint, jsonify, render_template, request

from app.auth import member_active_required
from app.database import get_db

bp = Blueprint("library", __name__, url_prefix="/library")


@bp.route("/")
@member_active_required
def index():
    with get_db() as conn:
        levels = conn.execute("SELECT * FROM library_levels ORDER BY level_number").fetchall()
        data = []
        for level in levels:
            cats = conn.execute(
                "SELECT * FROM library_categories WHERE level_id = ? ORDER BY sort_order, name_ar",
                (level["id"],),
            ).fetchall()
            data.append({"level": dict(level), "categories": [dict(c) for c in cats]})
    return render_template("library/index.html", levels_data=data)


@bp.route("/level/<int:level_num>")
@member_active_required
def level(level_num):
    with get_db() as conn:
        level_row = conn.execute(
            "SELECT * FROM library_levels WHERE level_number = ?", (level_num,)
        ).fetchone()
        if not level_row:
            return render_template("errors/404.html"), 404
        categories = conn.execute(
            "SELECT * FROM library_categories WHERE level_id = ? ORDER BY sort_order",
            (level_row["id"],),
        ).fetchall()
        videos_by_cat = {}
        for cat in categories:
            vids = conn.execute(
                """SELECT * FROM videos WHERE category_id = ? AND is_published = 1
                   ORDER BY sort_order, title""",
                (cat["id"],),
            ).fetchall()
            videos_by_cat[cat["id"]] = [dict(v) for v in vids]
    return render_template(
        "library/level.html",
        level=dict(level_row),
        categories=[dict(c) for c in categories],
        videos_by_cat=videos_by_cat,
    )


@bp.route("/video/<int:video_id>")
@member_active_required
def video(video_id):
    with get_db() as conn:
        vid = conn.execute(
            """SELECT v.*, c.name_ar as category_name, l.name_ar as level_name, l.level_number
               FROM videos v
               JOIN library_categories c ON v.category_id = c.id
               JOIN library_levels l ON c.level_id = l.id
               WHERE v.id = ?""",
            (video_id,),
        ).fetchone()
        segments = conn.execute(
            "SELECT * FROM video_transcript_segments WHERE video_id = ? ORDER BY start_seconds",
            (video_id,),
        ).fetchall()
    if not vid:
        return render_template("errors/404.html"), 404
    return render_template(
        "library/video.html",
        video=dict(vid),
        segments=[dict(s) for s in segments],
    )


@bp.route("/search")
@member_active_required
def search():
    q = request.args.get("q", "").strip()
    results = []
    if q and len(q) >= 2:
        words = [w for w in re.split(r"\s+", q) if len(w) >= 2]
        with get_db() as conn:
            segments = conn.execute(
                """SELECT s.*, v.title as video_title, v.id as video_id
                   FROM video_transcript_segments s
                   JOIN videos v ON s.video_id = v.id
                   WHERE v.is_published = 1"""
            ).fetchall()
            for seg in segments:
                text_lower = seg["text"].lower()
                if any(w.lower() in text_lower for w in words):
                    m = int(seg["start_seconds"] // 60)
                    s = int(seg["start_seconds"] % 60)
                    results.append({
                        "video_id": seg["video_id"],
                        "video_title": seg["video_title"],
                        "text": seg["text"],
                        "timestamp": f"{m:02d}:{s:02d}",
                        "start_seconds": seg["start_seconds"],
                    })
    return render_template("library/search.html", query=q, results=results)


@bp.route("/api/search")
@member_active_required
def api_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])
    words = [w.lower() for w in re.split(r"\s+", q) if len(w) >= 2]
    hits = []
    with get_db() as conn:
        rows = conn.execute(
            """SELECT s.start_seconds, s.end_seconds, s.text, v.id, v.title
               FROM video_transcript_segments s JOIN videos v ON s.video_id = v.id"""
        ).fetchall()
    for row in rows:
        if any(w in row["text"].lower() for w in words):
            hits.append({
                "video_id": row["id"],
                "title": row["title"],
                "text": row["text"],
                "start": row["start_seconds"],
            })
    return jsonify(hits[:50])
