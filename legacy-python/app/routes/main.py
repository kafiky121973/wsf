import re

from flask import Blueprint, render_template

from app.services.rag_bridge import get_row_by_slug

bp = Blueprint("main", __name__)


@bp.route("/")
def index():
    return render_template("index.html")


@bp.route("/about")
def about():
    return render_template("about.html")


@bp.route("/waei/source/<slug>")
def waei_source(slug):
    entry = get_row_by_slug(slug)
    if not entry:
        return render_template("errors/404.html"), 404
    tags_display = " · ".join(
        t.strip()
        for t in re.split(r"[;,،]", entry.get("tags") or "")
        if t.strip()
    )
    return render_template(
        "waei/source.html",
        entry=entry,
        tags_display=tags_display,
        library_url=f"/library/search?q={entry.get('title', '')}",
    )
