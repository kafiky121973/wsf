from app.database import get_db

DEFAULT_THEME = {
    "site_name": "شفرة الفطرة",
    "site_subtitle": "The Blueprint",
    "primary_color": "#C9A227",
    "secondary_color": "#1A1510",
    "accent_color": "#8B6914",
    "background_gradient": "linear-gradient(135deg, #0D0B08 0%, #1A1510 50%, #2A2218 100%)",
    "font_family": "'Amiri', 'Segoe UI', serif",
    "hero_tagline": "الحصن الرقمي",
    "logo_text": "شفرة الفطرة",
}


def get_theme():
    theme = dict(DEFAULT_THEME)
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM theme_settings").fetchall()
    for row in rows:
        theme[row["key"]] = row["value"]
    return theme
