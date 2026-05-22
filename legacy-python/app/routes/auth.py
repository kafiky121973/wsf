from datetime import datetime

from flask import Blueprint, flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from app.auth import login_user, logout_user
from app.database import get_db

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        with get_db() as conn:
            user = conn.execute(
                "SELECT * FROM users WHERE username = ? OR email = ?",
                (username, username),
            ).fetchone()
            if user and check_password_hash(user["password_hash"], password):
                login_user(user["id"], user["username"], user["role"])
                conn.execute(
                    "UPDATE users SET last_login = ? WHERE id = ?",
                    (datetime.utcnow().isoformat(), user["id"]),
                )
                flash(f"أهلاً بك في الحصن، {user['full_name'] or user['username']}.", "success")
                if user["role"] == "admin":
                    return redirect(url_for("admin.dashboard"))
                if user["role"] == "designer":
                    return redirect(url_for("designer.studio"))
                if user["role"] == "supervisor":
                    return redirect(url_for("admin.dashboard"))
                if user["status"] != "active":
                    return redirect(url_for("register.status"))
                return redirect(url_for("main.index"))
        flash("بيانات الدخول غير صحيحة.", "danger")
    return render_template("auth/login.html")


@bp.route("/logout")
def logout():
    logout_user()
    flash("خرجت من الحصن بسلام. إلى اللقاء.", "info")
    return redirect(url_for("main.index"))
