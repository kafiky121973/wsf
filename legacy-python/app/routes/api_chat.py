"""واجهة JSON للمساعد — تعمل مع Flask (منفذ 5000) وNode."""

from flask import Blueprint, jsonify, request, session

from app.services.rag_bridge import build_chat_response

bp = Blueprint("api_chat", __name__)


@bp.route("/api/cadres/chat", methods=["POST"])
def cadres_chat():
    if "user_id" not in session:
        return jsonify(
            ok=False,
            error="سجّل الدخول لاستخدام المساعد.",
            loginUrl="/auth/login?next=/cadres",
        ), 401
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    exclude = body.get("excludeSlugs") if isinstance(body.get("excludeSlugs"), list) else []

    if len(question) < 2:
        return jsonify(ok=False, error="اكتب سؤالاً أوضح (حرفان على الأقل)."), 400
    if len(question) > 2000:
        return jsonify(ok=False, error="السؤال طويل جداً (الحد 2000 حرف)."), 400

    return jsonify(build_chat_response(question, exclude))


@bp.route("/api/health", methods=["GET"])
def api_health():
    from app.services.rag_bridge import _load_rows

    return jsonify(ok=True, engine="flask", rag_rows=len(_load_rows()))
