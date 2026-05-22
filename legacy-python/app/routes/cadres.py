from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from app.auth import member_active_required, role_required
from app.database import get_db
from app.services.knowledge_ai import generate_ai_response, search_knowledge

bp = Blueprint("cadres", __name__, url_prefix="/cadres")


@bp.route("/")
@member_active_required
def index():
    return render_template("cadres/index.html")


@bp.route("/consult", methods=["GET", "POST"])
@member_active_required
def consult():
    if request.method == "POST":
        question = request.form.get("question", "").strip()
        if not question:
            flash("اكتب سؤالك عن البروتوكول الفطري.", "warning")
            return render_template("cadres/consult.html")
        ai_response = generate_ai_response(question)
        now = datetime.utcnow().isoformat()
        with get_db() as conn:
            conn.execute(
                """INSERT INTO consultations (member_id, question, ai_response, status, created_at)
                   VALUES (?, ?, ?, 'open', ?)""",
                (session["user_id"], question, ai_response, now),
            )
        flash("تم إنشاء الاستشارة. راجع الرد أدناه.", "success")
        return redirect(url_for("cadres.my_consultations"))
    return render_template("cadres/consult.html")


@bp.route("/my-consultations")
@member_active_required
def my_consultations():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM consultations WHERE member_id = ? ORDER BY created_at DESC",
            (session["user_id"],),
        ).fetchall()
    return render_template("cadres/my_consultations.html", consultations=[dict(r) for r in rows])


@bp.route("/knowledge/search")
@member_active_required
def knowledge_search():
    q = request.args.get("q", "")
    results = search_knowledge(q) if q else []
    return render_template("cadres/knowledge_search.html", query=q, results=results)


@bp.route("/panel")
@role_required("cadre", "admin")
def panel():
    with get_db() as conn:
        open_q = conn.execute(
            """SELECT c.*, u.username, u.full_name FROM consultations c
               JOIN users u ON c.member_id = u.id WHERE c.status = 'open'
               ORDER BY c.created_at DESC"""
        ).fetchall()
    return render_template("cadres/panel.html", consultations=[dict(q) for q in open_q])


@bp.route("/panel/<int:cid>/reply", methods=["POST"])
@role_required("cadre", "admin")
def reply_consultation(cid):
    response = request.form.get("cadre_response", "").strip()
    with get_db() as conn:
        profile = conn.execute(
            "SELECT verified_signature FROM cadre_profiles WHERE user_id = ?", (session["user_id"],)
        ).fetchone()
        sig = profile["verified_signature"] if profile else "كادر معتمد"
        signed = f"{response}\n\n— {sig}"
        conn.execute(
            """UPDATE consultations SET cadre_id = ?, cadre_response = ?, status = 'answered', answered_at = ?
               WHERE id = ?""",
            (session["user_id"], signed, datetime.utcnow().isoformat(), cid),
        )
    flash("تم إرسال الرد الموثّق.", "success")
    return redirect(url_for("cadres.panel"))
