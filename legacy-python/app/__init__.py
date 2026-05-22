from flask import Flask

from app.database import init_db


def create_app():
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.config.from_object("config")

    init_db()

    from app.routes import auth, main, library, community, cadres, market, admin, designer, register, api_chat

    app.register_blueprint(api_chat.bp)
    app.register_blueprint(main.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(register.bp)
    app.register_blueprint(library.bp)
    app.register_blueprint(community.bp)
    app.register_blueprint(cadres.bp)
    app.register_blueprint(market.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(designer.bp)

    @app.before_request
    def guard_cadres_for_guests():
        from flask import jsonify, redirect, request, session, url_for

        path = request.path or ""
        if session.get("user_id"):
            return None
        if path == "/cadres" or path.startswith("/cadres/") or path.startswith("/api/cadres"):
            if path.startswith("/api/"):
                return jsonify(
                    ok=False,
                    error="سجّل الدخول لاستخدام المساعد.",
                    loginUrl="/auth/login?next=/cadres",
                ), 401
            return redirect(url_for("auth.login", next="/cadres"))
        return None

    @app.context_processor
    def inject_globals():
        from app.auth import current_user
        from app.theme import get_theme

        user = current_user()
        return {
            "current_user": user,
            "is_guest": not user,
            "member_nav": bool(user and user.get("status") != "rejected"),
            "theme": get_theme(),
        }

    return app
