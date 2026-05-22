import json
from datetime import datetime
import math

from flask import Blueprint, flash, redirect, render_template, request, session, url_for

from app.auth import member_active_required, role_required
from app.database import get_db

bp = Blueprint("market", __name__, url_prefix="/market")


def _haversine(lat1, lon1, lat2, lon2):
    r = 6371
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 2 * r * math.asin(math.sqrt(a))


@bp.route("/")
@member_active_required
def index():
    with get_db() as conn:
        points = conn.execute(
            "SELECT * FROM distribution_points WHERE is_active = 1 ORDER BY region, city"
        ).fetchall()
    return render_template("market/index.html", points=[dict(p) for p in points])


@bp.route("/order", methods=["GET", "POST"])
@member_active_required
def order():
    with get_db() as conn:
        points = conn.execute("SELECT * FROM distribution_points WHERE is_active = 1").fetchall()

    if request.method == "POST":
        items = request.form.get("items", "").strip()
        if not items:
            flash("حدد احتياجاتك من الطيبات.", "warning")
            return render_template("market/order.html", points=[dict(p) for p in points])

        lat = request.form.get("lat", type=float)
        lng = request.form.get("lng", type=float)
        point_id = request.form.get("point_id", type=int)

        if lat and lng and not point_id:
            best, best_d = None, float("inf")
            for p in points:
                if p["lat"] and p["lng"]:
                    d = _haversine(lat, lng, p["lat"], p["lng"])
                    if d < best_d:
                        best_d, best = d, p["id"]
            point_id = best

        now = datetime.utcnow().isoformat()
        with get_db() as conn:
            conn.execute(
                """INSERT INTO market_orders (user_id, items_json, notes, distribution_point_id, status, created_at)
                   VALUES (?, ?, ?, ?, 'pending', ?)""",
                (
                    session["user_id"],
                    json.dumps({"items": items}, ensure_ascii=False),
                    request.form.get("notes"),
                    point_id,
                    now,
                ),
            )
        flash("تم إرسال طلبك إلى غرفة التحكم. سيُوجَّه لأقرب محراب.", "success")
        return redirect(url_for("market.my_orders"))

    return render_template("market/order.html", points=[dict(p) for p in points])


@bp.route("/my-orders")
@member_active_required
def my_orders():
    with get_db() as conn:
        orders = conn.execute(
            """SELECT o.*, d.name as point_name, d.city FROM market_orders o
               LEFT JOIN distribution_points d ON o.distribution_point_id = d.id
               WHERE o.user_id = ? ORDER BY o.created_at DESC""",
            (session["user_id"],),
        ).fetchall()
    return render_template("market/my_orders.html", orders=[dict(o) for o in orders])


@bp.route("/manage")
@role_required("admin", "supervisor")
def manage_points():
    with get_db() as conn:
        points = conn.execute("SELECT * FROM distribution_points ORDER BY region").fetchall()
    return render_template("market/manage.html", points=[dict(p) for p in points])


@bp.route("/manage/add", methods=["POST"])
@role_required("admin", "supervisor")
def add_point():
    now = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO distribution_points (name, region, city, address, lat, lng, contact_phone, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (
                request.form.get("name"),
                request.form.get("region"),
                request.form.get("city"),
                request.form.get("address"),
                request.form.get("lat", type=float),
                request.form.get("lng", type=float),
                request.form.get("contact_phone"),
                now,
            ),
        )
    flash("تمت إضافة نقطة التوزيع (المحراب).", "success")
    return redirect(url_for("market.manage_points"))
