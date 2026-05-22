const { getDb } = require("./db");
const { hasPermission } = require("./permissions");
const { parseSessionUserId } = require("./ids");

function syncSessionFromDb(req) {
  const uid = parseSessionUserId(req.session);
  if (!uid) return;
  const db = getDb();
  try {
    const row = db.prepare("SELECT role FROM users WHERE id = ?").get(uid);
    if (row?.role) req.session.role = row.role;
  } finally {
    db.close();
  }
}

function flash(req, category, message) {
  if (!req.session.flash) req.session.flash = [];
  req.session.flash.push([category, message]);
}

/** صلاحية من جدول role_permissions — المدير دائماً مسموح */
function requirePermission(resource, action = "read") {
  return (req, res, next) => {
    if (!req.session?.userId) {
      flash(req, "warning", "يجب تسجيل الدخول أولاً.");
      return res.redirect("/auth/login");
    }
    syncSessionFromDb(req);
    const role = req.session.role || "";
    if (role === "admin") return next();
    const db = getDb();
    try {
      if (hasPermission(role, resource, action, db)) return next();
      flash(req, "danger", "ليس لديك صلاحية لهذا الإجراء.");
      return res.redirect(req.session.role === "designer" ? "/designer" : "/");
    } finally {
      db.close();
    }
  };
}

/** مشرف أو مدير */
function requireStaff() {
  return (req, res, next) => {
    if (!req.session?.userId) return res.redirect("/auth/login");
    syncSessionFromDb(req);
    if (["admin", "supervisor"].includes(req.session.role)) return next();
    flash(req, "danger", "ليس لديك صلاحية.");
    return res.redirect("/");
  };
}

module.exports = { requirePermission, requireStaff, syncSessionFromDb };
