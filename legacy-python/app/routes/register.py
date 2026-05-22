import json
from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, session, url_for
from werkzeug.security import generate_password_hash

from app.auth import login_user
from app.database import get_db

bp = Blueprint("register", __name__, url_prefix="/join")

MIN_ANSWER_CHARS = 50


@bp.route("/")
def start():
    return render_template("register/start.html")


@bp.route("/account", methods=["GET", "POST"])
def account():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip()
        full_name = request.form.get("full_name", "").strip()
        password = request.form.get("password", "")
        if len(password) < 8:
            flash("كلمة المرور يجب أن تكون 8 أحرف على الأقل.", "danger")
            return render_template("register/account.html")
        now = datetime.utcnow().isoformat()
        try:
            with get_db() as conn:
                conn.execute(
                    """INSERT INTO users (username, email, password_hash, full_name, role, status, created_at)
                       VALUES (?, ?, ?, ?, 'pending', 'pending', ?)""",
                    (username, email, generate_password_hash(password), full_name, now),
                )
                user = conn.execute("SELECT id, username, role FROM users WHERE username = ?", (username,)).fetchone()
            login_user(user["id"], user["username"], user["role"])
            flash("تم إنشاء حسابك. أكمل بروتوكول الانضمام.", "success")
            return redirect(url_for("register.pledge"))
        except Exception:
            flash("اسم المستخدم أو البريد مستخدم مسبقاً.", "danger")
    return render_template("register/account.html")


@bp.route("/pledge", methods=["GET", "POST"])
def pledge():
    if "user_id" not in session:
        return redirect(url_for("register.account"))
    with get_db() as conn:
        statement = conn.execute(
            "SELECT * FROM sovereignty_statement WHERE is_active = 1 ORDER BY version DESC LIMIT 1"
        ).fetchone()
    if request.method == "POST":
        if not request.form.get("accept"):
            flash("يجب الموافقة على بيان استرداد السيادة للمتابعة.", "warning")
            return render_template("register/pledge.html", statement=statement)
        with get_db() as conn:
            conn.execute(
                "UPDATE users SET pledge_accepted_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), session["user_id"]),
            )
        flash("تم تسجيل إقرارك بالالتزام.", "success")
        return redirect(url_for("register.quiz"))
    return render_template("register/pledge.html", statement=statement)


@bp.route("/quiz", methods=["GET", "POST"])
def quiz():
    if "user_id" not in session:
        return redirect(url_for("register.account"))
    with get_db() as conn:
        user = conn.execute(
            "SELECT pledge_accepted_at, quiz_passed_at FROM users WHERE id = ?", (session["user_id"],)
        ).fetchone()
        if not user or not user["pledge_accepted_at"]:
            return redirect(url_for("register.pledge"))
        questions = conn.execute(
            "SELECT * FROM quiz_questions WHERE is_active = 1 ORDER BY order_num"
        ).fetchall()
        saved = conn.execute(
            "SELECT question_id, answer_text FROM quiz_answers WHERE user_id = ?", (session["user_id"],)
        ).fetchall()
        saved_answers = {r["question_id"]: r["answer_text"] for r in saved}

    if request.method == "POST":
        if user["quiz_passed_at"]:
            flash("إجاباتك قيد المراجعة مسبقاً.", "info")
            return redirect(url_for("register.status"))
        errors = []
        for q in questions:
            text = (request.form.get(f"q_{q['id']}") or "").strip()
            min_c = q["min_chars"] if "min_chars" in q.keys() else MIN_ANSWER_CHARS
            if len(text) < min_c:
                errors.append(f"السؤال {q['order_num'] + 1}: الحد الأدنى {min_c} حرفاً.")
        if errors:
            flash(" ".join(errors), "danger")
            return render_template(
                "register/quiz.html",
                questions=questions,
                saved_answers=saved_answers,
                already_submitted=False,
            )
        now = datetime.utcnow().isoformat()
        with get_db() as conn:
            for q in questions:
                text = (request.form.get(f"q_{q['id']}") or "").strip()
                conn.execute(
                    """INSERT INTO quiz_answers (user_id, question_id, answer_text, submitted_at)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(user_id, question_id) DO UPDATE SET answer_text = excluded.answer_text,
                       submitted_at = excluded.submitted_at""",
                    (session["user_id"], q["id"], text, now),
                )
            conn.execute(
                "UPDATE users SET quiz_passed_at = ? WHERE id = ?",
                (now, session["user_id"]),
            )
        flash("أُرسلت إجاباتك لمراجعة رفيق السيادة.", "success")
        return redirect(url_for("register.status"))

    return render_template(
        "register/quiz.html",
        questions=questions,
        saved_answers=saved_answers,
        already_submitted=bool(user["quiz_passed_at"]),
    )


@bp.route("/status")
def status():
    if "user_id" not in session:
        return redirect(url_for("register.start"))
    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    return render_template("register/status.html", user=dict(user) if user else None)
