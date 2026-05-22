const crypto = require("crypto");

function ensureCsrfToken(req) {
  if (!req.session) return "";
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  return req.session.csrfToken;
}

const CSRF_FAIL_MSG = "انتهت صلاحية النموذج — حدّث الصفحة وأعد المحاولة.";

/** مسارات عامة — إعادة توجيه بدل نص 403 خام */
const CSRF_REDIRECT = {
  "/join/account": "/join/account",
  "/join/resend-verification": "/join/account",
  "/auth/login": "/auth/login",
  "/auth/forgot-password": "/auth/forgot-password",
  "/auth/reset-password": "/auth/forgot-password",
};

function validateCsrf(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  if (req.path.startsWith("/api/cadres/chat")) return next();
  const token = req.body?._csrf || req.get("X-CSRF-Token");
  const expected = req.session?.csrfToken;
  if (expected && token === expected) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(403).json({ ok: false, error: "csrf_invalid", message: CSRF_FAIL_MSG });
  }
  const back = CSRF_REDIRECT[req.path];
  if (back && req.session) {
    req.session.flash = req.session.flash || [];
    req.session.flash.push(["warning", CSRF_FAIL_MSG]);
    if (req.path === "/join/resend-verification" && req.body?.email) {
      const email = String(req.body.email).trim().toLowerCase();
      if (email) {
        return res.redirect(`/join/verify-sent?email=${encodeURIComponent(email)}`);
      }
    }
    return res.redirect(back);
  }
  return res.status(403).send(CSRF_FAIL_MSG);
}

module.exports = { ensureCsrfToken, validateCsrf };
