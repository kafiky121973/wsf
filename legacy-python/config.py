import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SECRET_KEY = os.environ.get("SECRET_KEY", "shifrat-al-fitra-dev-change-in-production")
DATABASE_PATH = BASE_DIR / "data" / "shifra.db"
UPLOAD_FOLDER = BASE_DIR / "uploads"
MAX_CONTENT_LENGTH = 512 * 1024 * 1024  # 512MB for video uploads

ROLES = ("admin", "supervisor", "designer", "cadre", "member", "pending")

ROLE_LABELS = {
    "admin": "مدير النظام",
    "supervisor": "مشرف / رقيب",
    "designer": "مصمم المنصة",
    "cadre": "كادر حارس",
    "member": "عضو خلف",
    "pending": "قيد التفعيل",
}
