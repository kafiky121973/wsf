from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from app.auth import role_required
from app.database import get_db
from config import ROLES, ROLE_LABELS

bp = Blueprint("admin", __name__, url_prefix="/admin")


@bp.route("/")
@role_required("admin", "supervisor")
def dashboard():
    with get_db() as conn:
        stats = {
            "users": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
            "pending_users": conn.execute(
                "SELECT COUNT(*) FROM users WHERE status = 'pending' AND quiz_passed_at IS NOT NULL"
            ).fetchone()[0],
            "pending_posts": conn.execute(
                "SELECT COUNT(*) FROM community_posts WHERE status = 'pending'"
            ).fetchone()[0],
            "videos": conn.execute("SELECT COUNT(*) FROM videos").fetchone()[0],
            "consultations": conn.execute(
                "SELECT COUNT(*) FROM consultations WHERE status = 'open'"
            ).fetchone()[0],
        }
        pending_users = conn.execute(
            """SELECT * FROM users WHERE status = 'pending' AND quiz_passed_at IS NOT NULL
               ORDER BY created_at DESC LIMIT 20"""
        ).fetchall()
    return render_template(
        "admin/dashboard.html",
        stats=stats,
        pending_users=[dict(u) for u in pending_users],
    )


@bp.route("/users")
@role_required("admin")
def users():
    with get_db() as conn:
        all_users = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
    return render_template(
        "admin/users.html",
        users=[dict(u) for u in all_users],
        roles=ROLES,
        role_labels=ROLE_LABELS,
    )


@bp.route("/users/<int:user_id>/approve", methods=["POST"])
@role_required("admin", "supervisor")
def approve_user(user_id):
    with get_db() as conn:
        conn.execute(
            """UPDATE users SET status = 'active', role = 'member', approved_by = ?, approved_at = ?
               WHERE id = ?""",
            (session["user_id"], datetime.utcnow().isoformat(), user_id),
        )
    flash("تم تفعيل العضو — أصبح خلفاً في الحصن.", "success")
    return redirect(url_for("admin.dashboard"))


@bp.route("/users/<int:user_id>/role", methods=["POST"])
@role_required("admin")
def set_role(user_id):
    role = request.form.get("role")
    if role not in ROLES:
        flash("دور غير صالح.", "danger")
        return redirect(url_for("admin.users"))
    with get_db() as conn:
        conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    flash("تم تحديث الدور.", "success")
    return redirect(url_for("admin.users"))


@bp.route("/permissions")
@role_required("admin")
def permissions():
    with get_db() as conn:
        perms = conn.execute("SELECT * FROM role_permissions ORDER BY role, resource").fetchall()
    return render_template("admin/permissions.html", permissions=[dict(p) for p in perms])


@bp.route("/permissions/update", methods=["POST"])
@role_required("admin")
def update_permissions():
    perm_id = request.form.get("perm_id", type=int)
    with get_db() as conn:
        conn.execute(
            """UPDATE role_permissions SET can_read = ?, can_write = ?, can_delete = ? WHERE id = ?""",
            (
                1 if request.form.get("can_read") else 0,
                1 if request.form.get("can_write") else 0,
                1 if request.form.get("can_delete") else 0,
                perm_id,
            ),
        )
    flash("تم تحديث الصلاحيات.", "success")
    return redirect(url_for("admin.permissions"))


@bp.route("/newsletter", methods=["GET", "POST"])
@role_required("admin")
def newsletter():
    if request.method == "POST":
        now = datetime.utcnow().isoformat()
        with get_db() as conn:
            conn.execute(
                """INSERT INTO newsletters (subject, content, created_by, sent_at, created_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    request.form.get("subject"),
                    request.form.get("content"),
                    session["user_id"],
                    now,
                    now,
                ),
            )
            members = conn.execute(
                "SELECT email, full_name FROM users WHERE status = 'active' AND role IN ('member','cadre','supervisor')"
            ).fetchall()
        flash(f"تم حفظ الجرعة الوعيّة وإعدادها لـ {len(members)} مشترك.", "success")
        return redirect(url_for("admin.newsletter"))

    with get_db() as conn:
        history = conn.execute(
            "SELECT * FROM newsletters ORDER BY created_at DESC LIMIT 20"
        ).fetchall()
    return render_template("admin/newsletter.html", history=[dict(h) for h in history])


@bp.route("/library/manage")
@role_required("admin", "supervisor")
def library_manage():
    with get_db() as conn:
        videos = conn.execute(
            """SELECT v.*, c.name_ar as cat_name FROM videos v
               JOIN library_categories c ON v.category_id = c.id ORDER BY v.created_at DESC"""
        ).fetchall()
    return render_template("admin/library_manage.html", videos=[dict(v) for v in videos])
