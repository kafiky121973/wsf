from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from app.auth import role_required
from app.database import get_db

bp = Blueprint("designer", __name__, url_prefix="/designer")

THEME_KEYS = [
    ("site_name", "اسم المنصة"),
    ("site_subtitle", "العنوان الفرعي"),
    ("logo_text", "نص الشعار"),
    ("hero_tagline", "شعار الصفحة الرئيسية"),
    ("primary_color", "اللون الذهبي الأساسي"),
    ("secondary_color", "لون الخلفية الداكنة"),
    ("accent_color", "لون التمييز"),
    ("background_gradient", "تدرج الخلفية (CSS)"),
    ("font_family", "خط المنصة"),
]


@bp.route("/")
@role_required("designer", "admin")
def studio():
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM theme_settings").fetchall()
    settings = {r["key"]: r["value"] for r in rows}
    return render_template("designer/studio.html", settings=settings, theme_keys=THEME_KEYS)


@bp.route("/save", methods=["POST"])
@role_required("designer", "admin")
def save():
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        for key, _label in THEME_KEYS:
            val = request.form.get(key)
            if val is not None:
                conn.execute(
                    """INSERT INTO theme_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
                       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at,
                       updated_by = excluded.updated_by""",
                    (key, val, now, session["user_id"]),
                )
    flash("تم تحديث تصميم المنصة. التغييرات ظاهرة فوراً.", "success")
    return redirect(url_for("designer.studio"))


@bp.route("/preview")
@role_required("designer", "admin")
def preview():
    return redirect(url_for("main.index"))
