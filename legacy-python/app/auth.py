from functools import wraps

from flask import flash, redirect, session, url_for

from app.database import get_db


def login_user(user_id, username, role):
    session["user_id"] = user_id
    session["username"] = username
    session["role"] = role


def logout_user():
    session.clear()


def current_user():
    if "user_id" not in session:
        return None
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    return dict(row) if row else None


def has_permission(role, resource, action="read"):
    col = {"read": "can_read", "write": "can_write", "delete": "can_delete"}.get(action, "can_read")
    with get_db() as conn:
        row = conn.execute(
            f"SELECT {col} FROM role_permissions WHERE role = ? AND resource = ?",
            (role, resource),
        ).fetchone()
    if role == "admin":
        return True
    return row and row[0] == 1


def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if "user_id" not in session:
                flash("يجب تسجيل الدخول أولاً.", "warning")
                return redirect(url_for("auth.login"))
            if session.get("role") not in roles and session.get("role") != "admin":
                flash("ليس لديك صلاحية للوصول إلى هذه الصفحة.", "danger")
                return redirect(url_for("main.index"))
            return f(*args, **kwargs)

        return wrapped

    return decorator


def permission_required(resource, action="read"):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if "user_id" not in session:
                flash("يجب تسجيل الدخول أولاً.", "warning")
                return redirect(url_for("auth.login"))
            role = session.get("role", "pending")
            if not has_permission(role, resource, action):
                flash("صلاحياتك لا تسمح بهذا الإجراء.", "danger")
                return redirect(url_for("main.index"))
            return f(*args, **kwargs)

        return wrapped

    return decorator


def member_active_required(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login"))
        with get_db() as conn:
            user = conn.execute("SELECT status, role FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        if not user or user["status"] != "active" or user["role"] == "pending":
            flash("عضويتك لم تُفعّل بعد. أكمل بروتوكول التسجيل أو انتظر موافقة رفيق السيادة.", "warning")
            return redirect(url_for("register.status"))
        return f(*args, **kwargs)

    return wrapped
