const rateLimit = require("express-rate-limit");

const IS_PROD = process.env.NODE_ENV === "production";

function isProduction() {
  return IS_PROD;
}

function getSiteOrigin() {
  const url = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** أصول مسموحة: SITE_URL + www + مضيف الطلب خلف البروكسي */
function allowedOrigins(req) {
  const list = new Set();
  const site = getSiteOrigin();
  if (site) {
    list.add(site);
    try {
      const u = new URL(site);
      if (u.hostname.startsWith("www.")) {
        list.add(`${u.protocol}//${u.hostname.slice(4)}${u.port ? `:${u.port}` : ""}`);
      } else {
        list.add(`${u.protocol}//www.${u.hostname}${u.port ? `:${u.port}` : ""}`);
      }
    } catch (_) {
      /* ignore */
    }
  }
  const host = req.get("x-forwarded-host") || req.get("host");
  const proto = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
  if (host) list.add(`${proto}://${host}`);
  return list;
}

function refererAllowed(referer, origins) {
  if (!referer) return true;
  for (const o of origins) {
    if (referer.startsWith(o)) return true;
  }
  return false;
}

/** تحذيرات عند التشغيل على دومين حقيقي */
function validateProductionConfig() {
  const issues = [];
  const secret = process.env.SECRET_KEY || "";
  const site = process.env.SITE_URL || "";

  if (IS_PROD) {
    if (!secret || secret.length < 32 || secret.includes("dev")) {
      issues.push("SECRET_KEY: عيّن مفتاحاً عشوائياً 32+ حرفاً في .env");
    }
    if (!site.startsWith("https://")) {
      issues.push("SITE_URL: يجب أن يبدأ بـ https:// على الإنتاج");
    }
    if (process.env.COOKIE_SECURE !== "true") {
      issues.push("COOKIE_SECURE=true مطلوب مع HTTPS");
    }
    if (process.env.FORCE_HTTPS !== "true") {
      issues.push("FORCE_HTTPS=true موصى به خلف nginx/Caddy");
    }
  }

  if (issues.length) {
    console.warn("\n⚠ تحذيرات أمان / النشر:");
    issues.forEach((m) => console.warn("  •", m));
    console.warn("");
  }
}

function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (IS_PROD) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ")
    );
  }
  next();
}

function forceHttps(req, res, next) {
  if (!IS_PROD || process.env.FORCE_HTTPS !== "true") return next();
  if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
  const host = req.headers.host || "";
  return res.redirect(301, `https://${host}${req.originalUrl}`);
}

/** منع CSRF — فعّل VERIFY_ORIGIN=1 أو ضبط SITE_URL على الإنتاج */
function verifyPostOrigin(req, res, next) {
  const enabled =
    process.env.VERIFY_ORIGIN === "1" ||
    (IS_PROD && process.env.SITE_URL && String(process.env.SITE_URL).trim());
  if (!enabled) return next();
  if (!IS_PROD) return next();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();

  const origins = allowedOrigins(req);
  if (!origins.size) return next();

  const origin = req.get("origin");
  const referer = req.get("referer") || "";

  if (origin && !origins.has(origin)) {
    console.warn("[security] origin_denied", origin, "expected", [...origins]);
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({ ok: false, error: "origin_denied" });
    }
    return res.status(403).send("طلب غير مسموح.");
  }
  if (!origin && referer && !refererAllowed(referer, origins)) {
    console.warn("[security] referer_denied", referer);
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({ ok: false, error: "origin_denied" });
    }
    return res.status(403).send("طلب غير مسموح.");
  }
  next();
}

function blockDangerousUploads(req, res, next) {
  if (/\.(php|phtml|cgi|asp|aspx|jsp|mjs|exe|bat|cmd|sh)$/i.test(req.path)) {
    return res.status(403).end();
  }
  next();
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PROD ? 25 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "محاولات كثيرة — انتظر قليلاً." },
  skipSuccessfulRequests: true,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: IS_PROD ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: "محاولات تسجيل كثيرة — جرّب لاحقاً.",
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 20 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "انتظر قليلاً قبل سؤال جديد." },
});

const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: IS_PROD ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  isProduction,
  getSiteOrigin,
  validateProductionConfig,
  securityHeaders,
  forceHttps,
  verifyPostOrigin,
  blockDangerousUploads,
  authLimiter,
  registerLimiter,
  chatLimiter,
  generalApiLimiter,
};
