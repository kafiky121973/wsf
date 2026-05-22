from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from app.auth import member_active_required, permission_required, role_required
from app.database import get_db

bp = Blueprint("community", __name__, url_prefix="/community")


@bp.route("/")
@member_active_required
def index():
    with get_db() as conn:
        posts = conn.execute(
            """SELECT p.*, u.username, u.full_name FROM community_posts p
               JOIN users u ON p.user_id = u.id
               WHERE p.status = 'approved' ORDER BY p.created_at DESC LIMIT 50"""
        ).fetchall()
    return render_template("community/index.html", posts=[dict(p) for p in posts])


@bp.route("/journal")
@member_active_required
def journal_list():
    with get_db() as conn:
        entries = conn.execute(
            "SELECT * FROM journals WHERE user_id = ? ORDER BY created_at DESC",
            (session["user_id"],),
        ).fetchall()
    return render_template("community/journal_list.html", entries=[dict(e) for e in entries])


@bp.route("/journal/new", methods=["GET", "POST"])
@member_active_required
def journal_new():
    if request.method == "POST":
        now = datetime.utcnow().isoformat()
        with get_db() as conn:
            conn.execute(
                """INSERT INTO journals (user_id, title, content, food_log, health_notes, obstacles, mood, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    session["user_id"],
                    request.form.get("title"),
                    request.form.get("content", ""),
                    request.form.get("food_log"),
                    request.form.get("health_notes"),
                    request.form.get("obstacles"),
                    request.form.get("mood"),
                    now,
                ),
            )
        flash("تم حفظ سجل الإنجاز.", "success")
        return redirect(url_for("community.journal_list"))
    return render_template("community/journal_form.html")


@bp.route("/submit", methods=["GET", "POST"])
@member_active_required
def submit_post():
    if request.method == "POST":
        now = datetime.utcnow().isoformat()
        with get_db() as conn:
            conn.execute(
                """INSERT INTO community_posts (user_id, post_type, title, content, status, created_at)
                   VALUES (?, ?, ?, ?, 'pending', ?)""",
                (
                    session["user_id"],
                    request.form.get("post_type", "testimony"),
                    request.form.get("title"),
                    request.form.get("content", ""),
                    now,
                ),
            )
        flash("تم إرسال مشاركتك لمراجعة الرقباء.", "info")
        return redirect(url_for("community.index"))
    return render_template("community/submit.html")


@bp.route("/moderation")
@role_required("supervisor", "admin")
def moderation():
    with get_db() as conn:
        pending = conn.execute(
            """SELECT p.*, u.username, u.full_name FROM community_posts p
               JOIN users u ON p.user_id = u.id WHERE p.status = 'pending' ORDER BY p.created_at"""
        ).fetchall()
    return render_template("community/moderation.html", posts=[dict(p) for p in pending])


@bp.route("/moderation/<int:post_id>/<action>", methods=["POST"])
@role_required("supervisor", "admin")
def moderate_post(post_id, action):
    if action not in ("approved", "rejected"):
        flash("إجراء غير صالح.", "danger")
        return redirect(url_for("community.moderation"))
    with get_db() as conn:
        conn.execute(
            """UPDATE community_posts SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ?
               WHERE id = ?""",
            (
                action,
                session["user_id"],
                datetime.utcnow().isoformat(),
                request.form.get("note", ""),
                post_id,
            ),
        )
    flash("تمت المراجعة.", "success")
    return redirect(url_for("community.moderation"))
