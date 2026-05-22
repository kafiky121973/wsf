const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    });
}
const express = require("express");
const nunjucks = require("nunjucks");
const bcrypt = require("bcryptjs");
const { getDb, initDb, getTheme, getDriver, dbReady } = require("./lib/db");
const { generateAiResponse, searchKnowledge, buildChatResponse } = require("./lib/ai");
const { llmStatus } = require("./lib/llm");
const { recordFeedback } = require("./lib/chat-feedback");
const { registerInstallPageRoute } = require("./lib/install-page-route");
const { sendWelcomeEmail } = require("./lib/mail");
const {
  activateMember,
  runAutoActivationGrace,
  tryGraceActivateUser,
} = require("./lib/member-activation");
const { startMemberScheduler } = require("./lib/member-scheduler");
const { sendVerifyEmail, sendPasswordResetEmail } = require("./lib/auth-email");
const { smtpConfigured, mailFromDisplay, mailFlashMessage } = require("./lib/mail");
const { buildSystemChecks } = require("./lib/system-checks");
const { getSettingsForm, saveAppSettings, clearAppSettings } = require("./lib/app-config");
const {
  TOKEN_TYPES,
  EMAIL_VERIFY_TTL_MINUTES,
  findValidToken,
  consumeToken,
} = require("./lib/auth-tokens");
const { needsEmailVerify, skipsEmailVerify } = require("./lib/auth-verify");
const { parseLocationBody } = require("./lib/location");
const { fetchIpLocation, getClientIp } = require("./lib/ip-location");
const { createSessionMiddleware, saveSession, clearSessionCookie } = require("./lib/session");
const multer = require("multer");
const {
  exportTemplate: exportAssistantTemplate,
  buildTemplateBuffer: buildAssistantTemplate,
  parseWorkbook: parseAssistantWorkbook,
  mergeImportRows: mergeAssistantRows,
  replaceImportRows: replaceAssistantRows,
  updateQaRow: updateAssistantQaRow,
} = require("./lib/assistant-excel");
const { importRows: importKnowledgeArticles } = require("./lib/knowledge-excel");
const {
  loadRagRows,
  reloadRag,
  suggestFollowUpQuestions,
  getRowBySlug,
  libraryDeepLinkFor,
} = require("./lib/rag-search");
const {
  buildTemplateBuffer: buildLibraryTemplate,
  buildTopicTemplateBuffer,
  listTopicPacks,
  parseWorkbook: parseLibraryWorkbook,
  importLibrary,
} = require("./lib/library-excel");
const { youtubeEmbedId, formatDuration } = require("./lib/library");
const { getVideoDurationSeconds } = require("./lib/video-meta");
const { previewNextDose } = require("./lib/newsletter-dose");
const {
  publishDose,
  isAutoEnabled,
  lastSentAt,
  getSetting,
  setSetting,
} = require("./lib/newsletter-send");
const { getPublicKey, saveSubscription } = require("./lib/push");
const { notifyMemberOfOwnerReply, notifyAdminsOfMemberMessage } = require("./lib/push-notify");
const { startNewsletterScheduler } = require("./lib/newsletter-scheduler");
const {
  EMOJI_PRESETS,
  sendMessage,
  listThread,
  markReadByMember,
  markReadByOwner,
  countUnreadForMember,
  countUnreadForOwner,
  adminInbox,
  getMember,
  MAX_BODY: OWNER_MSG_MAX,
} = require("./lib/owner-messages");
const { urlFor, buildBreadcrumbs } = require("./lib/page-paths");
const { HERO_TAGLINE, resolveLogoUrl, isLogoSvg } = require("./lib/site-constants");
const { computeJournalStats, MOODS, moodMeta } = require("./lib/journal");
const { mediaKind, displayAuthor } = require("./lib/gallery");
const { touchLastSeen, getPresenceStats, enrichUsersPresence, ONLINE_MINUTES } = require("./lib/presence");
const {
  getPresenceTotalsForUsers,
  formatDurationSeconds,
} = require("./lib/presence-duration");
const { updateMemberRole, deleteMemberAccount } = require("./lib/user-admin");
const { parseUserId, parseSessionUserId } = require("./lib/ids");
const { RESOURCE_LABELS } = require("./lib/permissions");
const { requirePermission, requireStaff } = require("./lib/route-guards");
const { ensureCsrfToken, validateCsrf } = require("./lib/csrf");
const {
  joinNextPath,
  getActiveStatement,
  getQuizQuestions,
  getSavedAnswers,
  saveQuizAnswers,
} = require("./lib/register-flow");
const {
  listPendingApplications,
  listQuizReviewQueue,
  getQuizAnswersForUser,
  approveUser,
  rejectUser,
  rejectQuizRetry,
} = require("./lib/admin-members");
const {
  NAV_ROLES,
  resolveNavLinks,
  getRoleNavState,
  saveRoleNav,
  parseRoleNavBody,
  seedRoleNav,
} = require("./lib/nav-menu");
const {
  listPointsForMember,
  productsByPointIds,
  allProductsGrouped,
  getMemberCity,
  mapsUrl,
} = require("./lib/market");
const {
  isProduction,
  validateProductionConfig,
  securityHeaders,
  forceHttps,
  verifyPostOrigin,
  blockDangerousUploads,
  authLimiter,
  registerLimiter,
  chatLimiter,
  generalApiLimiter,
} = require("./lib/security");

const UPLOADS_DIR = path.join(__dirname, "uploads");
const VIDEOS_DIR = path.join(UPLOADS_DIR, "videos");
const GALLERY_DIR = path.join(UPLOADS_DIR, "gallery");
[UPLOADS_DIR, VIDEOS_DIR, GALLERY_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, "") || ".mp4";
      const safe = Date.now() + "-" + file.originalname.replace(/[^\w.\-]+/g, "_").slice(0, 80) + ext;
      cb(null, safe);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      /^video\//i.test(file.mimetype) ||
      /\.(mp4|webm|mov|m4v|mkv)$/i.test(file.originalname);
    cb(null, ok);
  },
});

const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, GALLERY_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, "") || ".jpg";
      const safe = Date.now() + "-" + file.originalname.replace(/[^\w.\-]+/g, "_").slice(0, 80) + ext;
      cb(null, safe);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      /^image\//i.test(file.mimetype) ||
      /^video\//i.test(file.mimetype) ||
      /\.(jpe?g|png|gif|webp|mp4|webm)$/i.test(file.originalname);
    cb(null, ok);
  },
});

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      /\.(xlsx|xls)$/i.test(file.originalname) ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel";
    cb(null, ok);
  },
});

const PORT = process.env.PORT || 3000;
const ROLE_LABELS = {
  admin: "مدير النظام",
  supervisor: "مشرف / رقيب",
  designer: "مصمم المنصة",
  cadre: "مستشار شخصي",
  member: "عضو خلف",
  pending: "قيد التفعيل",
  guest: "زائر (غير مسجّل)",
  rejected: "حساب مرفوض",
};
const ROLES = ["admin", "supervisor", "designer", "cadre", "member", "pending"];

const {
  getDatabaseForm,
  saveDatabaseSettings,
  testDatabaseConnection,
} = require("./lib/database-settings");

function main() {
const app = express();
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
app.disable("x-powered-by");
app.use(forceHttps);
app.use(securityHeaders);
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.json({ limit: "512kb" }));
app.use(createSessionMiddleware());
app.use((req, res, next) => {
  if (req.session) ensureCsrfToken(req);
  next();
});
if (isProduction() || process.env.CSRF_STRICT === "1") {
  app.use(validateCsrf);
}
app.use(verifyPostOrigin);
/** المساعد — لا يُعرض ولا يُستدعى قبل تسجيل الدخول */
app.use((req, res, next) => {
  const p = req.path || "";
  if (!req.session?.userId && (p === "/cadres" || p.startsWith("/cadres/") || p.startsWith("/api/cadres"))) {
    if (p.startsWith("/api/")) {
      return res.status(401).json({
        ok: false,
        error: "سجّل الدخول لاستخدام المساعد.",
        loginUrl: "/auth/login?next=/cadres",
      });
    }
    const nextUrl = encodeURIComponent(req.originalUrl || p);
    return res.redirect(`/auth/login?next=${nextUrl}`);
  }
  next();
});
app.use((req, _res, next) => {
  if (req.session?.userId) touchLastSeen(req.session.userId);
  next();
});
app.use("/static", express.static(path.join(__dirname, "static"), { maxAge: isProduction() ? "7d" : 0 }));
app.use(
  "/uploads",
  blockDangerousUploads,
  express.static(path.join(UPLOADS_DIR), { maxAge: isProduction() ? "1d" : 0 })
);
app.use("/api", generalApiLimiter);

app.get("/manifest.webmanifest", (req, res) => {
  res.type("application/manifest+json");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(path.join(__dirname, "static", "manifest.webmanifest"));
});

app.get("/sw.js", (req, res) => {
  res.type("application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  res.sendFile(path.join(__dirname, "static", "sw.js"));
});

const env = nunjucks.configure(path.join(__dirname, "templates"), {
  autoescape: true,
  express: app,
  noCache: !isProduction(),
});
env.addGlobal("mapsUrl", mapsUrl);
env.addFilter("fmtDateTime", (iso) => {
  if (!iso) return "";
  return String(iso).slice(0, 16).replace("T", " — ");
});
env.addFilter("fmtDuration", (sec) => formatDurationSeconds(sec));
env.addFilter("excerpt", (text, len) => {
  const n = len || 220;
  if (!text) return "";
  return text.length > n ? text.slice(0, n) + "…" : text;
});
env.addFilter("urlencode", (s) => encodeURIComponent(String(s || "")));
env.addFilter("moodIcon", (mood) => moodMeta(mood).icon);
env.addFilter("moodClass", (mood) => moodMeta(mood).cls);
env.addFilter("starsDisplay", (n) => {
  const s = parseInt(n, 10);
  if (!s || s < 1) return "—";
  return "★".repeat(Math.min(5, s)) + "☆".repeat(5 - Math.min(5, s));
});
env.addGlobal("fmtTime", (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
});
env.addGlobal("youtubeEmbedId", youtubeEmbedId);
env.addGlobal("formatDuration", formatDuration);
env.addGlobal("journalMoods", MOODS);
env.addGlobal("moodMeta", moodMeta);
env.addGlobal("mediaKind", mediaKind);
env.addGlobal("displayAuthor", displayAuthor);
env.addGlobal("role_labels", ROLE_LABELS);
env.addGlobal("MEMBER_ROLES", ROLES);
env.addGlobal("url_for", urlFor);

function flash(req, category, message) {
  if (!req.session.flash) req.session.flash = [];
  req.session.flash.push([category, message]);
}

function getFlash(req) {
  const m = req.session.flash || [];
  req.session.flash = [];
  return m;
}

/** مسار إعادة توجيه آمن بعد النماذج */
function safeReturnPath(path, fallback = "/") {
  const p = (path || "").trim();
  if (p.startsWith("/") && !p.startsWith("//")) return p;
  return fallback;
}

function profileLocationUrl(returnTo) {
  const r = safeReturnPath(returnTo, "/");
  return `/profile/location?return=${encodeURIComponent(r)}`;
}

/** إحصائية المسجّلين حسب الدولة / المدينة / الحي */
function getLocationStats(db) {
  const locOk = (col) =>
    `${col} IS NOT NULL AND TRIM(${col}) != '' AND TRIM(${col}) != '—'`;
  const by_country = db
    .prepare(
      `SELECT country, COUNT(*) AS count FROM users
       WHERE ${locOk("country")}
       GROUP BY country ORDER BY count DESC, country COLLATE NOCASE`
    )
    .all();
  const by_city = db
    .prepare(
      `SELECT country, city, COUNT(*) AS count FROM users
       WHERE ${locOk("country")} AND ${locOk("city")}
       GROUP BY country, city ORDER BY count DESC, country COLLATE NOCASE, city COLLATE NOCASE`
    )
    .all();
  const by_district = db
    .prepare(
      `SELECT country, city, district, COUNT(*) AS count FROM users
       WHERE ${locOk("country")} AND ${locOk("city")} AND ${locOk("district")}
       GROUP BY country, city, district
       ORDER BY count DESC, country COLLATE NOCASE, city COLLATE NOCASE, district COLLATE NOCASE`
    )
    .all();
  const total = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  const with_location = db
    .prepare(
      `SELECT COUNT(*) AS c FROM users WHERE ${locOk("country")} AND ${locOk("city")} AND ${locOk("district")}`
    )
    .get().c;
  return { by_country, by_city, by_district, total, with_location };
}

function currentUser(req) {
  const uid = parseSessionUserId(req.session);
  if (!uid) return null;
  const db = getDb();
  try {
    return db.prepare("SELECT * FROM users WHERE id = ?").get(uid);
  } finally {
    db.close();
  }
}

function siteRenderLocals() {
  const site_logo_src = resolveLogoUrl() || "/static/icons/icon.svg";
  return {
    site_logo_src,
    logo_url: site_logo_src,
    logo_is_svg: isLogoSvg(site_logo_src),
    site_tagline: HERO_TAGLINE,
  };
}

app.use((req, res, next) => {
  Object.assign(res.locals, siteRenderLocals());
  next();
});

function render(req, res, tpl, ctx = {}) {
  const db = getDb();
  try {
    const breadcrumbs = buildBreadcrumbs(req, ctx);
    const user = currentUser(req);
    const is_guest = !user;
    const member_nav = !!user && user.status !== "rejected";
    let owner_unread = 0;
    if (user && user.status === "active") {
      if (["member", "cadre"].includes(user.role)) {
        owner_unread = countUnreadForMember(db, user.id);
      } else if (["admin", "supervisor"].includes(user.role)) {
        owner_unread = countUnreadForOwner(db);
      }
    }
    const theme = getTheme(db);
    const nav_links = resolveNavLinks(db, { user, is_guest });
    res.render(tpl, {
      current_user: user,
      is_guest,
      member_nav,
      nav_links,
      theme,
      messages: getFlash(req),
      role_labels: ROLE_LABELS,
      roles: ROLES,
      breadcrumbs,
      owner_unread,
      csrf_token: ensureCsrfToken(req),
      ...ctx,
      breadcrumbs: ctx.breadcrumbs ?? breadcrumbs,
      ...siteRenderLocals(),
    });
  } finally {
    db.close();
  }
}

function render404(req, res) {
  res.status(404);
  render(req, res, "errors/404.html");
}

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

function staffCanManageUsers(user) {
  return user && (user.role === "admin" || user.role === "supervisor");
}

function staffCanDeleteUsers(user) {
  return user && user.role === "admin";
}

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    const path = req.path || "";
    let msg = "يجب تسجيل الدخول أولاً.";
    if (path.startsWith("/cadres") || path.startsWith("/api/cadres")) {
      msg = "سجّل الدخول لاستخدام المساعد.";
    } else if (path.startsWith("/library")) {
      msg = "مكتبة الوعي للأعضاء — سجّل دخولك أو انضم.";
    } else if (path.startsWith("/community") || path.startsWith("/market") || path.startsWith("/owner")) {
      msg = "هذه الخدمة للأعضاء — سجّل دخولك أو انضم.";
    }
    flash(req, "warning", msg);
    const nextUrl = encodeURIComponent(req.originalUrl || req.url);
    return res.redirect(`/auth/login?next=${nextUrl}`);
  }
  syncSessionFromDb(req);
  next();
}

/** رفع الشهادات — أعضاء مفعّلون فقط (العرض في /gallery للجميع) */
function requireMemberUpload(req, res, next) {
  if (!req.session.userId) {
    flash(req, "warning", "رفع الشهادات للأعضاء فقط — سجّل دخولك أو انضم للمنصة.");
    const next = encodeURIComponent(req.originalUrl || req.url);
    return res.redirect(`/auth/login?next=${next}`);
  }
  let u = currentUser(req);
  if (!u) return res.redirect("/gallery");
  if (u.status === "rejected") {
    flash(req, "warning", "طلبك مرفوض — لا يمكنك الرفع. يمكنك مشاهدة المعرض العام.");
    return res.redirect("/gallery");
  }
  const db = getDb();
  try {
    u = ensureUserActive(db, u) || u;
  } finally {
    db.close();
  }
  if (!u || u.status !== "active") {
    flash(req, "warning", "لا يمكن الرفع حالياً.");
    return res.redirect("/gallery");
  }
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.session.userId) return res.redirect("/auth/login");
    syncSessionFromDb(req);
    if (!roles.includes(req.session.role) && req.session.role !== "admin") {
      flash(req, "danger", "ليس لديك صلاحية للوصول إلى هذه الصفحة.");
      return res.redirect("/");
    }
    next();
  };
}

function ensureUserActive(db, user) {
  if (!user || user.status === "rejected") return user;
  return tryGraceActivateUser(db, user) || user;
}

function requireActive(req, res, next) {
  let u = currentUser(req);
  if (!u) return res.redirect("/auth/login");
  if (u.status === "rejected") {
    flash(req, "warning", "طلبك مرفوض. راجع بريدك أو قدّم طلباً جديداً.");
    return res.redirect("/join/status");
  }
  const db = getDb();
  try {
    const updated = ensureUserActive(db, u);
    if (updated) u = updated;
    if (u && (u.status !== "active" || u.role === "pending")) {
      const nextJoin = joinNextPath(u);
      flash(
        req,
        "warning",
        nextJoin ? "أكمل خطوات الانضمام أو انتظر مراجعة الطلب." : "حسابك لم يُفعّل بعد."
      );
      return res.redirect(nextJoin || "/join/status");
    }
    if (req.session && u) req.session.role = u.role;
  } finally {
    db.close();
  }
  next();
}

/** واجهة JSON للمساعد — نفس شروط العضوية النشطة */
function requireApiMember(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      ok: false,
      error: "سجّل الدخول لاستخدام المساعد.",
      loginUrl: "/auth/login?next=/cadres",
    });
  }
  const db = getDb();
  try {
    let u = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
    if (!u) {
      return res.status(401).json({ ok: false, error: "سجّل الدخول لاستخدام المساعد." });
    }
    if (u.status === "rejected") {
      return res.status(403).json({ ok: false, error: "طلبك مرفوض." });
    }
    if (needsEmailVerify(u)) {
      return res.status(403).json({
        ok: false,
        error: "أكّد بريدك أولاً.",
        verifyUrl: `/join/verify-sent?email=${encodeURIComponent(u.email)}`,
      });
    }
    u = ensureUserActive(db, u) || u;
    const joinPath = joinNextPath(u);
    if (joinPath) {
      return res.status(403).json({ ok: false, error: "أكمل الانضمام أو انتظر المراجعة.", joinUrl: joinPath });
    }
    if (u.status !== "active" || u.role === "pending") {
      return res.status(403).json({ ok: false, error: "حسابك لم يُفعّل بعد." });
    }
    if (req.session) req.session.role = u.role;
    next();
  } finally {
    db.close();
  }
}

// ——— Main ———
app.get("/api/location/from-ip", async (req, res) => {
  try {
    const place = await fetchIpLocation(getClientIp(req));
    res.json({
      ok: true,
      lat: place.lat,
      lng: place.lng,
      country: place.country,
      city: place.city,
      district: place.district,
      source: "ip",
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message || "فشل تحديد الموقع" });
  }
});

app.get("/", (req, res) => render(req, res, "index.html"));

// ——— Auth ———
app.get("/auth/login", (req, res) => {
  if (req.session?.userId) {
    return res.redirect("/");
  }
  const next = (req.query.next || "").trim();
  const loggedOut = req.query.logout === "1";
  render(req, res, "auth/login.html", { next, loggedOut });
});
app.post("/auth/login", authLimiter, async (req, res) => {
  const email = (req.body.email || req.body.username || "").trim().toLowerCase();
  const { password } = req.body;
  const next = (req.body.next || "").trim();
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  const db = getDb();
  try {
    let user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);
    if (user && bcrypt.compareSync(password, user.password_hash)) {
      user = tryGraceActivateUser(db, user) || user;
      if (user.status === "rejected") {
        flash(req, "warning", "طلبك مرفوض. راجع بريدك.");
        return res.redirect("/join/status");
      }
      if (needsEmailVerify(user)) {
        flash(
        req,
        "warning",
        `أكّد بريدك بالضغط على رابط التأكيد في بريدك (صالح ${EMAIL_VERIFY_TTL_MINUTES} دقيقة) — أو أعد الإرسال.`
      );
        return res.redirect(`/join/verify-sent?email=${encodeURIComponent(user.email)}`);
      }
      user = ensureUserActive(db, user) || user;
      const remember =
        req.body.remember_me === "1" ||
        req.body.remember_me === "on" ||
        req.body.remember_me === "true";
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.rememberMe = remember;
      db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(new Date().toISOString(), user.id);
      try {
        await saveSession(req, remember);
      } catch (e) {
        console.error("[session]", e);
        flash(req, "danger", "تعذّر حفظ الجلسة — جرّب مرة أخرى.");
        return res.redirect("/auth/login");
      }
      flash(req, "success", `أهلاً بك، ${user.full_name || user.email}.`);
      const joinPath = joinNextPath(user);
      if (joinPath) return res.redirect(safeNext || joinPath);
      if (user.role === "admin" || user.role === "supervisor") return res.redirect(safeNext || "/admin");
      if (user.role === "designer") return res.redirect(safeNext || "/designer");
      if (user.status !== "active" || user.role === "pending") return res.redirect(safeNext || "/join/status");
      return res.redirect(safeNext || "/cadres");
    }
    flash(req, "danger", "البريد أو كلمة المرور غير صحيحة.");
    res.redirect("/auth/login");
  } finally {
    db.close();
  }
});
app.get("/auth/logout", (req, res) => {
  const sid = req.sessionID;
  req.session.destroy((err) => {
    if (err) console.error("[session] logout", err);
    clearSessionCookie(res);
    if (sid) {
      try {
        const db = getDb();
        db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
        db.close();
      } catch (_) {}
    }
    const next = (req.query.next || "").trim();
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? `&next=${encodeURIComponent(next)}` : "";
    res.redirect(`/auth/login?logout=1${safeNext}`);
  });
});

app.get("/auth/forgot-password", (req, res) => {
  if (req.session?.userId) return res.redirect("/");
  render(req, res, "auth/forgot_password.html");
});

app.post("/auth/forgot-password", authLimiter, async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const db = getDb();
  try {
    const user = email ? db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email) : null;
    if (user && user.status !== "rejected") {
      let mailResult;
      try {
        mailResult = await sendPasswordResetEmail(db, user);
      } catch (e) {
        console.error("[mail] reset", e);
        mailResult = { ok: false, status: "error", error: e.message };
      }
      const resetFlash = mailFlashMessage(mailResult, {
        successMessage:
          "أُرسل رابط إعادة التعيين إلى بريدك — راجع الوارد والبريد المزعج (صالح ساعتين).",
        isProduction: isProduction(),
      });
      flash(req, resetFlash.type, resetFlash.message);
    } else {
      flash(
        req,
        "success",
        "إن كان البريد مسجّلاً، ستصلك رسالة برابط إعادة التعيين خلال دقائق."
      );
    }
    res.redirect("/auth/login");
  } finally {
    db.close();
  }
});

app.get("/auth/reset-password", (req, res) => {
  const token = (req.query.token || "").trim();
  if (!token) {
    flash(req, "warning", "رابط غير صالح.");
    return res.redirect("/auth/forgot-password");
  }
  const db = getDb();
  try {
    const row = findValidToken(db, token, TOKEN_TYPES.PASSWORD_RESET);
    if (!row) {
      flash(req, "danger", "انتهت صلاحية الرابط أو استُخدم مسبقاً. اطلب رابطاً جديداً.");
      return res.redirect("/auth/forgot-password");
    }
    render(req, res, "auth/reset_password.html", { token });
  } finally {
    db.close();
  }
});

app.post("/auth/reset-password", (req, res) => {
  const token = (req.body.token || "").trim();
  const password = req.body.password || "";
  const password_confirm = req.body.password_confirm || "";
  if (!token) {
    flash(req, "warning", "رابط غير صالح.");
    return res.redirect("/auth/forgot-password");
  }
  if (password.length < 8) {
    flash(req, "danger", "كلمة المرور 8 أحرف على الأقل.");
    return res.redirect(`/auth/reset-password?token=${encodeURIComponent(token)}`);
  }
  if (password !== password_confirm) {
    flash(req, "danger", "كلمتا المرور غير متطابقتين.");
    return res.redirect(`/auth/reset-password?token=${encodeURIComponent(token)}`);
  }
  const db = getDb();
  try {
    const row = findValidToken(db, token, TOKEN_TYPES.PASSWORD_RESET);
    if (!row) {
      flash(req, "danger", "انتهت صلاحية الرابط.");
      return res.redirect("/auth/forgot-password");
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.user_id);
    consumeToken(db, row.id);
    flash(req, "success", "تم تعيين كلمة المرور. يمكنك الدخول الآن.");
    res.redirect("/auth/login");
  } finally {
    db.close();
  }
});

app.get("/auth/verify-email", async (req, res) => {
  const token = (req.query.token || "").trim();
  if (!token) {
    flash(req, "warning", "رابط تأكيد غير صالح.");
    return res.redirect("/auth/login");
  }
  const db = getDb();
  try {
    const row = findValidToken(db, token, TOKEN_TYPES.EMAIL_VERIFY);
    if (!row) {
      flash(req, "danger", "انتهت صلاحية رابط التأكيد. اطلب إرسالاً جديداً من صفحة التأكيد.");
      return res.redirect("/auth/login");
    }
    const now = new Date().toISOString();
    consumeToken(db, row.id);
    db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(now, row.user_id);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id);
    if (user.status !== "rejected") {
      const active = db.prepare("SELECT * FROM users WHERE id = ?").get(row.user_id);
      req.session.userId = active.id;
      req.session.username = active.username;
      req.session.role = active.role;
      req.session.rememberMe = true;
      db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(now, active.id);
      try {
        await saveSession(req, true);
      } catch (e) {
        console.error("[verify]", e);
        flash(req, "success", "تم تأكيد بريدك — سجّل دخولك الآن.");
        return res.redirect("/auth/login");
      }
      const next = joinNextPath(active) || "/join/pledge";
      flash(req, "success", `تم تأكيد بريدك. أكمل خطوات الانضمام، ${active.full_name || active.email}.`);
      return res.redirect(next);
    }
    flash(req, "success", "تم تأكيد البريد.");
    res.redirect("/auth/login");
  } finally {
    db.close();
  }
});

// ——— Register ———
async function pendingEmailVerification(req, res, db, userId, email) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  let mailResult;
  try {
    mailResult = await sendVerifyEmail(db, user);
  } catch (e) {
    console.error("[mail] verify", e);
    mailResult = { ok: false, status: "error", error: e.message };
  }
  const flashMsg = mailFlashMessage(mailResult, {
    successMessage:
      "أُرسل رابط التأكيد من «شفرة الفطرة». بعد التأكيد أكمل الإقرار واختبار الوعي ثم انتظر مراجعة الطلب (أو التفعيل التلقائي بعد 72 ساعة من إكمال الاختبار).",
    isProduction: isProduction(),
  });
  flash(req, flashMsg.type, flashMsg.message);
  res.redirect(`/join/verify-sent?email=${encodeURIComponent(email)}`);
}

function requireJoinProgress(req, res, next) {
  const db = getDb();
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
    if (!user) return res.redirect("/auth/login");
    if (user.status === "rejected") return res.redirect("/join/status");
    if (!user.email_verified_at && needsEmailVerify(user)) {
      return res.redirect(`/join/verify-sent?email=${encodeURIComponent(user.email)}`);
    }
    if (user.status === "active" && user.role !== "pending") return res.redirect("/cadres");
    req.joinUser = user;
    next();
  } finally {
    db.close();
  }
}

app.get("/join", (req, res) => res.redirect("/join/account"));
app.get("/join/account", (req, res) => render(req, res, "register/account.html"));
app.get("/join/verify-sent", (req, res) => {
  const email = (req.query.email || "").trim().toLowerCase();
  if (!email) return res.redirect("/join/account");
  const db = getDb();
  let verify_ttl_minutes = EMAIL_VERIFY_TTL_MINUTES;
  let mail_from = mailFromDisplay();
  try {
    const { cfg } = require("./lib/app-config").getAppConfig(db);
    verify_ttl_minutes = parseInt(cfg.EMAIL_VERIFY_TTL_MINUTES || EMAIL_VERIFY_TTL_MINUTES, 10);
    mail_from = mailFromDisplay(db);
  } finally {
    db.close();
  }
  render(req, res, "register/verify_sent.html", {
    email,
    mail_from,
    verify_ttl_minutes,
  });
});
app.post("/join/resend-verification", authLimiter, async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  if (!email) {
    flash(req, "warning", "أدخل البريد الإلكتروني.");
    return res.redirect("/join/account");
  }
  const db = getDb();
  try {
    const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);
    if (user && needsEmailVerify(user)) {
      let mailResult;
      try {
        mailResult = await sendVerifyEmail(db, user);
      } catch (e) {
        console.error("[mail] resend", e);
        mailResult = { ok: false, status: "error", error: e.message };
      }
      const flashMsg = mailFlashMessage(mailResult, {
        successMessage: "أُعيد إرسال رابط التأكيد — راجع الوارد والبريد المزعج.",
        isProduction: isProduction(),
      });
      flash(req, flashMsg.type, flashMsg.message);
    } else {
      flash(req, "success", "إن كان البريد مسجّلاً ولم يُؤكَّد، ستصلك رسالة قريباً.");
    }
    res.redirect(`/join/verify-sent?email=${encodeURIComponent(email)}`);
  } finally {
    db.close();
  }
});
app.post("/join/account", registerLimiter, async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const full_name = (req.body.full_name || "").trim();
  const { password, password_confirm } = req.body;
  const loc = parseLocationBody(req.body);

  if (!full_name || !email) {
    flash(req, "danger", "الاسم والبريد مطلوبان.");
    return res.redirect("/join/account");
  }
  if (!loc.ok) {
    flash(req, "danger", loc.errors.join(" "));
    return res.redirect("/join/account");
  }
  const { country, city, district, lat, lng } = loc.data;
  if (!password || password.length < 8) {
    flash(req, "danger", "كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    return res.redirect("/join/account");
  }
  if (password !== password_confirm) {
    flash(req, "danger", "كلمتا المرور غير متطابقتين.");
    return res.redirect("/join/account");
  }

  const username = email.split("@")[0] + "_" + Date.now().toString(36).slice(-4);
  const db = getDb();
  try {
    const exists = db.prepare("SELECT id, status FROM users WHERE lower(email) = ?").get(email);
    if (exists) {
      if (exists.status === "rejected") {
        const hash = bcrypt.hashSync(password, 10);
        const row = db.prepare("SELECT id, username FROM users WHERE lower(email) = ?").get(email);
        const now = new Date().toISOString();
        db.prepare(
          `UPDATE users SET password_hash = ?, full_name = ?, country = ?, city = ?, district = ?,
           lat = ?, lng = ?, location_updated_at = ?, created_at = ?,
           status = 'pending', role = 'pending', email_verified_at = NULL,
           rejected_at = NULL, rejection_note = NULL, approved_at = NULL, approved_by = NULL
           WHERE id = ?`
        ).run(hash, full_name, country, city, district, lat, lng, now, now, row.id);
        return await pendingEmailVerification(req, res, db, row.id, email);
      }
      const pending = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);
      if (pending && needsEmailVerify(pending)) {
        flash(req, "warning", "هذا البريد مسجّل ولم يُؤكَّد بعد. أعد إرسال رابط التأكيد.");
        return res.redirect(`/join/verify-sent?email=${encodeURIComponent(email)}`);
      }
      flash(req, "danger", "هذا البريد مسجّل مسبقاً.");
      return res.redirect("/join/account");
    }
    const hash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();
    const r = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, full_name, country, city, district, lat, lng, location_updated_at, role, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`
      )
      .run(username, email, hash, full_name, country, city, district, lat, lng, now, now);
    const userId = r.lastInsertRowid;
    return await pendingEmailVerification(req, res, db, userId, email);
  } catch (e) {
    console.error(e);
    flash(req, "danger", "تعذّر إنشاء الحساب. تحقق من البيانات.");
    res.redirect("/join/account");
  } finally {
    db.close();
  }
});
app.get("/join/pledge", requireLogin, requireJoinProgress, (req, res) => {
  if (req.joinUser.pledge_accepted_at) return res.redirect("/join/quiz");
  const db = getDb();
  try {
    const statement = getActiveStatement(db);
    if (!statement) {
      flash(req, "danger", "بيان السيادة غير متوفر — تواصل مع الإدارة.");
      return res.redirect("/join/status");
    }
    render(req, res, "register/pledge.html", { statement });
  } finally {
    db.close();
  }
});
app.post("/join/pledge", requireLogin, requireJoinProgress, (req, res) => {
  if (req.body.accept !== "1") {
    flash(req, "warning", "يجب الموافقة على الميثاق للمتابعة.");
    return res.redirect("/join/pledge");
  }
  const db = getDb();
  try {
    const now = new Date().toISOString();
    db.prepare("UPDATE users SET pledge_accepted_at = ? WHERE id = ?").run(now, req.session.userId);
    flash(req, "success", "تم قبول الميثاق. أكمل اختبار الوعي.");
    res.redirect("/join/quiz");
  } finally {
    db.close();
  }
});
app.get("/join/quiz", requireLogin, requireJoinProgress, (req, res) => {
  if (!req.joinUser.pledge_accepted_at) return res.redirect("/join/pledge");
  const db = getDb();
  try {
    const questions = getQuizQuestions(db);
    if (!questions.length) {
      flash(req, "danger", "أسئلة الاختبار غير جاهزة — تواصل مع الإدارة.");
      return res.redirect("/join/status");
    }
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
    render(req, res, "register/quiz.html", {
      questions,
      saved_answers: getSavedAnswers(db, user.id),
      already_submitted: !!user.quiz_passed_at,
    });
  } finally {
    db.close();
  }
});
app.post("/join/quiz", requireLogin, requireJoinProgress, (req, res) => {
  if (!req.joinUser.pledge_accepted_at) return res.redirect("/join/pledge");
  const db = getDb();
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
    if (user.quiz_passed_at) return res.redirect("/join/status");
    const questions = getQuizQuestions(db);
    const result = saveQuizAnswers(db, user.id, questions, req.body);
    if (!result.ok) {
      flash(req, "danger", result.errors.join(" "));
      return res.redirect("/join/quiz");
    }
    flash(req, "success", "أُرسلت إجاباتك. بانتظار مراجعة الرقباء.");
    res.redirect("/join/status");
  } finally {
    db.close();
  }
});
app.get("/join/status", requireLogin, (req, res) => {
  const db = getDb();
  try {
    let user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
    if (!user) return res.redirect("/auth/login");
    if (user.status === "rejected") return render(req, res, "register/status.html", { user });
    user = ensureUserActive(db, user) || user;
    if (req.session) req.session.role = user.role;
    if (user.status === "active" && user.role !== "pending") return res.redirect("/cadres");
    const next = joinNextPath(user);
    if (next && next !== "/join/status") return res.redirect(next);
    render(req, res, "register/status.html", { user });
  } finally {
    db.close();
  }
});

// ——— تحديث الموقع (نفس آلية GPS — بدون إدخال يدوي) ———
app.get("/profile/location", requireLogin, (req, res) => {
  const u = currentUser(req);
  if (!u) {
    req.session.destroy(() => res.redirect("/auth/login"));
    return;
  }
  const return_to = safeReturnPath(req.query.return, "/");
  render(req, res, "profile/location.html", { user: u, return_to });
});
app.post("/profile/location", requireLogin, (req, res) => {
  const return_to = safeReturnPath(req.body.return_to, "/");
  const loc = parseLocationBody(req.body);
  if (!loc.ok) {
    flash(req, "danger", loc.errors.join(" "));
    return res.redirect(profileLocationUrl(return_to));
  }
  const { country, city, district, lat, lng } = loc.data;
  const db = getDb();
  try {
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users SET country = ?, city = ?, district = ?, lat = ?, lng = ?, location_updated_at = ? WHERE id = ?`
    ).run(country, city, district, lat, lng, now, req.session.userId);
    flash(req, "success", "تم تحديث الموقع.");
    res.redirect(return_to);
  } finally {
    db.close();
  }
});

// ——— مراسلة المالك ———
app.get("/owner", requireLogin, requireActive, (req, res) => {
  const u = currentUser(req);
  if (!["member", "cadre"].includes(u.role)) {
    if (u.role === "admin" || u.role === "supervisor") {
      return res.redirect("/admin/owner-messages");
    }
    flash(req, "warning", "مقترحاتكم للأعضاء والكادر النشطين فقط.");
    return res.redirect("/");
  }
  const db = getDb();
  try {
    markReadByMember(db, u.id);
    const thread = listThread(db, u.id);
    render(req, res, "owner/thread.html", {
      thread,
      emoji_presets: EMOJI_PRESETS,
      max_body: OWNER_MSG_MAX,
    });
  } finally {
    db.close();
  }
});

app.post("/owner/send", requireLogin, requireActive, async (req, res) => {
  const u = currentUser(req);
  if (!["member", "cadre"].includes(u.role)) {
    return res.redirect("/");
  }
  const db = getDb();
  try {
    const msg = sendMessage(db, u.id, "member", req.body.body);
    if (!msg) {
      flash(req, "warning", "اكتب رسالة قبل الإرسال.");
    } else {
      flash(req, "success", "تم إرسال رسالتك للمالك.");
      try {
        await notifyAdminsOfMemberMessage(db, u.id, u, msg.body);
      } catch (e) {
        console.error("[push] owner-in", e.message || e);
      }
    }
    res.redirect("/owner");
  } finally {
    db.close();
  }
});

app.get("/admin/owner-messages", requireLogin, requirePermission("users", "read"), (req, res) => {
  const db = getDb();
  try {
    const inbox = adminInbox(db);
    const firstId = inbox[0]?.id;
    const targetId = parseInt(req.query.member, 10) || firstId;
    let active_member = null;
    let thread = [];
    if (targetId) {
      active_member = getMember(db, targetId);
      if (active_member) {
        markReadByOwner(db, targetId);
        thread = listThread(db, targetId);
      }
    }
    render(req, res, "admin/owner_messages.html", {
      inbox,
      active_member,
      thread,
      owner_unread_total: countUnreadForOwner(db),
      emoji_presets: EMOJI_PRESETS,
      max_body: OWNER_MSG_MAX,
    });
  } finally {
    db.close();
  }
});

app.get("/admin/owner-messages/:memberId", requireLogin, requirePermission("users", "read"), (req, res) => {
  res.redirect(`/admin/owner-messages?member=${req.params.memberId}`);
});

app.post(
  "/admin/owner-messages/:memberId/send",
  requireLogin,
  requirePermission("users", "write"),
  async (req, res) => {
    const memberId = parseInt(req.params.memberId, 10);
    const db = getDb();
    try {
      const member = getMember(db, memberId);
      if (!member) return render404(req, res);
      const msg = sendMessage(db, memberId, "owner", req.body.body);
      if (!msg) {
        flash(req, "warning", "اكتب رداً قبل الإرسال.");
      } else {
        flash(req, "success", `تم إرسال الرد إلى ${member.full_name || member.username}.`);
        try {
          await notifyMemberOfOwnerReply(db, memberId, msg.body);
        } catch (e) {
          console.error("[push] owner-reply", e.message || e);
        }
      }
      res.redirect(`/admin/owner-messages?member=${memberId}`);
    } finally {
      db.close();
    }
  }
);

// ——— Library ———
app.get("/library", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const levels = db.prepare("SELECT * FROM library_levels ORDER BY level_number").all();
    const totalVideos = db.prepare("SELECT COUNT(*) AS c FROM videos WHERE is_published = 1").get().c;
    const levels_data = levels.map((level) => {
      const categories = db
        .prepare("SELECT * FROM library_categories WHERE level_id = ? ORDER BY sort_order, name_ar")
        .all(level.id);
      const videoCount = db
        .prepare(
          `SELECT COUNT(*) AS c FROM videos v
           JOIN library_categories c ON v.category_id = c.id
           WHERE c.level_id = ? AND v.is_published = 1`
        )
        .get(level.id).c;
      return { level, categories, videoCount };
    });
    render(req, res, "library/index.html", { levels_data, totalVideos });
  } finally {
    db.close();
  }
});
app.get("/library/level/:num", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const level = db.prepare("SELECT * FROM library_levels WHERE level_number = ?").get(req.params.num);
    if (!level) return render404(req, res);
    const categories = db.prepare("SELECT * FROM library_categories WHERE level_id = ? ORDER BY sort_order").all(level.id);
    const videos_by_cat = {};
    categories.forEach((cat) => {
      videos_by_cat[cat.id] = db
        .prepare("SELECT * FROM videos WHERE category_id = ? AND is_published = 1 ORDER BY sort_order, title")
        .all(cat.id);
    });
    render(req, res, "library/level.html", { level, categories, videos_by_cat });
  } finally {
    db.close();
  }
});
app.get("/library/video/:id", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const video = db
      .prepare(
        `SELECT v.*, c.name_ar as category_name, l.name_ar as level_name, l.level_number
         FROM videos v JOIN library_categories c ON v.category_id = c.id
         JOIN library_levels l ON c.level_id = l.id
         WHERE v.id = ? AND v.is_published = 1`
      )
      .get(req.params.id);
    if (!video) return render404(req, res);
    const segments = db
      .prepare("SELECT * FROM video_transcript_segments WHERE video_id = ? ORDER BY start_seconds")
      .all(req.params.id);
    render(req, res, "library/video.html", { video, segments });
  } finally {
    db.close();
  }
});
app.get("/library/search", requireLogin, requireActive, (req, res) => {
  const q = (req.query.q || "").trim();
  const results = [];
  if (q.length >= 2) {
    const words = q.split(/\s+/).filter((w) => w.length >= 2);
    const db = getDb();
    try {
      const segments = db
        .prepare(
          `SELECT s.*, v.title as video_title, v.id as video_id
           FROM video_transcript_segments s JOIN videos v ON s.video_id = v.id WHERE v.is_published = 1`
        )
        .all();
      const seen = new Set();
      segments.forEach((seg) => {
        if (!words.some((w) => seg.text.toLowerCase().includes(w.toLowerCase()))) return;
        const key = `${seg.video_id}:${Math.floor(seg.start_seconds)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const m = Math.floor(seg.start_seconds / 60);
        const s = Math.floor(seg.start_seconds % 60);
        results.push({
          video_id: seg.video_id,
          video_title: seg.video_title,
          text: seg.text,
          timestamp: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
          start_seconds: seg.start_seconds,
        });
      });
      results.sort((a, b) => a.video_id - b.video_id || a.start_seconds - b.start_seconds);
    } finally {
      db.close();
    }
  }
  render(req, res, "library/search.html", { query: q, results });
});

// ——— Gallery (public) ———
app.get("/gallery", (req, res) => {
  const filter = req.query.type || "all";
  const db = getDb();
  try {
    let sql = `SELECT p.*, u.username, u.full_name FROM community_posts p
               JOIN users u ON p.user_id = u.id WHERE p.status = 'approved'`;
    const params = [];
    if (filter === "testimony" || filter === "video") {
      sql += " AND p.post_type = ?";
      params.push(filter);
    }
    sql += " ORDER BY p.reviewed_at DESC, p.created_at DESC LIMIT 100";
    const posts = db.prepare(sql).all(...params);
    const counts = {
      all: db.prepare("SELECT COUNT(*) AS c FROM community_posts WHERE status = 'approved'").get().c,
      testimony: db
        .prepare("SELECT COUNT(*) AS c FROM community_posts WHERE status = 'approved' AND post_type = 'testimony'")
        .get().c,
      video: db
        .prepare("SELECT COUNT(*) AS c FROM community_posts WHERE status = 'approved' AND post_type = 'video'")
        .get().c,
    };
    render(req, res, "gallery/index.html", { posts, filter, counts });
  } finally {
    db.close();
  }
});

app.get("/gallery/:id", (req, res) => {
  const db = getDb();
  try {
    const post = db
      .prepare(
        `SELECT p.*, u.username, u.full_name FROM community_posts p
         JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.status = 'approved'`
      )
      .get(req.params.id);
    if (!post) return render404(req, res);
    render(req, res, "gallery/show.html", { post });
  } finally {
    db.close();
  }
});

// ——— Community ———
app.get("/community", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const posts = db
      .prepare(
        `SELECT p.*, u.username, u.full_name FROM community_posts p
         JOIN users u ON p.user_id = u.id WHERE p.status = 'approved'
         ORDER BY p.created_at DESC LIMIT 50`
      )
      .all();
    render(req, res, "community/index.html", { posts });
  } finally {
    db.close();
  }
});
app.get("/community/journal", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const entries = db
      .prepare("SELECT * FROM journals WHERE user_id = ? ORDER BY created_at DESC")
      .all(req.session.userId);
    const stats = computeJournalStats(entries);
    render(req, res, "community/journal_list.html", { entries, stats });
  } finally {
    db.close();
  }
});

app.get("/community/journal/new", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const lastDay = db
      .prepare("SELECT MAX(day_number) AS d FROM journals WHERE user_id = ? AND day_number IS NOT NULL")
      .get(req.session.userId);
    const suggestedDay = Math.min(40, (lastDay?.d || 0) + 1);
    render(req, res, "community/journal_form.html", { entry: null, suggestedDay });
  } finally {
    db.close();
  }
});

app.post("/community/journal/new", requireLogin, requireActive, (req, res) => {
  const content = (req.body.content || "").trim();
  if (!content) {
    flash(req, "warning", "اكتب يومياتك — حقل إلزامي.");
    return res.redirect("/community/journal/new");
  }
  const dayNum = parseInt(req.body.day_number, 10);
  const db = getDb();
  try {
    const b = req.body;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO journals (user_id, title, content, food_log, health_notes, obstacles, mood, day_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.session.userId,
      (b.title || "").trim() || null,
      content,
      (b.food_log || "").trim() || null,
      (b.health_notes || "").trim() || null,
      (b.obstacles || "").trim() || null,
      (b.mood || "").trim() || null,
      dayNum >= 1 && dayNum <= 40 ? dayNum : null,
      now,
      now
    );
    flash(req, "success", "تم حفظ سجل الإنجاز.");
    res.redirect("/community/journal");
  } finally {
    db.close();
  }
});

app.get("/community/journal/:id", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const entry = db
      .prepare("SELECT * FROM journals WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId);
    if (!entry) return render404(req, res);
    render(req, res, "community/journal_view.html", { entry });
  } finally {
    db.close();
  }
});

app.get("/community/journal/:id/edit", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const entry = db
      .prepare("SELECT * FROM journals WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId);
    if (!entry) return render404(req, res);
    render(req, res, "community/journal_form.html", { entry, suggestedDay: entry.day_number });
  } finally {
    db.close();
  }
});

app.post("/community/journal/:id/edit", requireLogin, requireActive, (req, res) => {
  const content = (req.body.content || "").trim();
  if (!content) {
    flash(req, "warning", "اكتب يومياتك — حقل إلزامي.");
    return res.redirect(`/community/journal/${req.params.id}/edit`);
  }
  const dayNum = parseInt(req.body.day_number, 10);
  const db = getDb();
  try {
    const entry = db
      .prepare("SELECT id FROM journals WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.session.userId);
    if (!entry) return render404(req, res);

    const b = req.body;
    db.prepare(
      `UPDATE journals SET title = ?, content = ?, food_log = ?, health_notes = ?, obstacles = ?, mood = ?, day_number = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      (b.title || "").trim() || null,
      content,
      (b.food_log || "").trim() || null,
      (b.health_notes || "").trim() || null,
      (b.obstacles || "").trim() || null,
      (b.mood || "").trim() || null,
      dayNum >= 1 && dayNum <= 40 ? dayNum : null,
      new Date().toISOString(),
      req.params.id,
      req.session.userId
    );
    flash(req, "success", "تم تحديث السجل.");
    res.redirect(`/community/journal/${req.params.id}`);
  } finally {
    db.close();
  }
});

app.post("/community/journal/:id/delete", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const r = db
      .prepare("DELETE FROM journals WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.session.userId);
    flash(req, r.changes ? "success" : "warning", r.changes ? "تم حذف السجل." : "السجل غير موجود.");
    res.redirect("/community/journal");
  } finally {
    db.close();
  }
});

app.get("/community/submit", requireMemberUpload, (req, res) =>
  render(req, res, "community/submit.html")
);
app.post(
  "/community/submit",
  requireMemberUpload,
  galleryUpload.single("media_file"),
  (req, res) => {
    const content = (req.body.content || "").trim();
    if (!content) {
      flash(req, "warning", "اكتب محتوى الشهادة أو وصف الفيديو.");
      return res.redirect("/community/submit");
    }
    const mediaPath = req.file ? `gallery/${req.file.filename}` : null;
    const youtubeUrl = (req.body.youtube_url || "").trim() || null;
    const db = getDb();
    try {
      db.prepare(
        `INSERT INTO community_posts (user_id, post_type, title, content, media_path, youtube_url, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).run(
        req.session.userId,
        req.body.post_type || "testimony",
        (req.body.title || "").trim() || null,
        content,
        mediaPath,
        youtubeUrl,
        new Date().toISOString()
      );
      flash(req, "info", "تم الإرسال للمراجعة. بعد الموافقة يظهر في المعرض العام للجميع.");
      res.redirect("/gallery");
    } finally {
      db.close();
    }
  }
);
app.get("/community/moderation", requireLogin, requirePermission("community", "write"), (req, res) => {
  const db = getDb();
  try {
    const posts = db
      .prepare(
        `SELECT p.*, u.username, u.full_name FROM community_posts p
         JOIN users u ON p.user_id = u.id WHERE p.status = 'pending' ORDER BY p.created_at`
      )
      .all();
    render(req, res, "community/moderation.html", { posts });
  } finally {
    db.close();
  }
});
app.post("/community/moderation/:id/:action", requireLogin, requirePermission("community", "write"), (req, res) => {
  const db = getDb();
  try {
    db.prepare(
      `UPDATE community_posts SET status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ? WHERE id = ?`
    ).run(req.params.action, req.session.userId, new Date().toISOString(), req.body.note || "", req.params.id);
    flash(req, "success", "تمت المراجعة.");
    res.redirect("/community/moderation");
  } finally {
    db.close();
  }
});

// ——— مكتبة الوعي — مصدر عام (بدون تسجيل) ———
app.get("/waei/source/:slug", (req, res) => {
  const slug = decodeURIComponent(req.params.slug || "").trim();
  const entry = getRowBySlug(slug);
  if (!entry) return render404(req, res);
  render(req, res, "waei/source.html", {
    entry,
    tags_display: String(entry.tags || "")
      .split(/[;,،]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .join(" · "),
    library_url: libraryDeepLinkFor(entry),
  });
});

app.get("/api/health", (_req, res) => {
  try {
    const rows = loadRagRows();
    res.json({ ok: true, engine: "node", rag_rows: rows.length, llm: llmStatus() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message) });
  }
});

// ——— Cadres ———
app.post("/api/cadres/chat", chatLimiter, requireApiMember, async (req, res) => {
  const question = (req.body.question || "").trim();
  const excludeSlugs = Array.isArray(req.body.excludeSlugs)
    ? req.body.excludeSlugs.filter((s) => typeof s === "string" && s.length && s.length < 80)
    : [];
  if (!question || question.length < 2) {
    return res.status(400).json({ ok: false, error: "اكتب سؤالاً أوضح (حرفان على الأقل)." });
  }
  if (question.length > 2000) {
    return res.status(400).json({ ok: false, error: "السؤال طويل جداً (الحد 2000 حرف)." });
  }
  const db = getDb();
  try {
    const chat = await buildChatResponse(db, question, excludeSlugs);
    if (!chat.text) {
      return res.json({
        ok: true,
        answer: "لم أجد رداً مناسباً في الأرشيف. جرّب صياغة أخرى.",
        sources: [],
        hasResults: false,
        rag: false,
        llm: false,
        confidence: "none",
        followUps: chat.followUps || suggestFollowUpQuestions(null, excludeSlugs),
        feedbackMode: "none",
      });
    }
    res.json({
      ok: true,
      answer: chat.text,
      sources: chat.sources || [],
      hasResults: !!chat.hasResults,
      rag: !!chat.rag,
      llm: !!chat.llm,
      confidence: chat.confidence || null,
      confidenceLabel: chat.confidenceLabel || null,
      title: chat.title || null,
      stage: chat.stage || null,
      slug: chat.slug || null,
      sourceUrl: chat.sourceUrl || null,
      libraryUrl: chat.libraryUrl || null,
      followUps: chat.followUps || { related: null, unrelated: null },
      feedbackMode: chat.feedbackMode || null,
    });
  } catch (e) {
    console.error("[chat]", e);
    res.status(500).json({ ok: false, error: "تعذّر معالجة السؤال." });
  } finally {
    db.close();
  }
});

app.post("/api/cadres/feedback", chatLimiter, requireApiMember, (req, res) => {
  const body = req.body || {};
  const question = (body.question || "").trim();
  const helpful = body.helpful;
  const db = getDb();
  try {
    const r = recordFeedback(db, req.session.userId, {
      question,
      helpful,
      slug: body.slug,
      answerMode: body.answerMode,
      note: body.note,
    });
    if (!r.ok) {
      return res.status(400).json({ ok: false, error: r.error || "تعذّر حفظ التقييم." });
    }
    res.json({ ok: true });
  } finally {
    db.close();
  }
});

app.get("/cadres", requireLogin, requireActive, (req, res) => {
  render(req, res, "cadres/index.html");
});
app.get("/cadres/consult", requireLogin, requireActive, (req, res) =>
  render(req, res, "cadres/consult.html")
);
app.post("/cadres/consult", requireLogin, requireActive, async (req, res) => {
  const question = (req.body.question || "").trim();
  if (!question) {
    flash(req, "warning", "اكتب سؤالك عن البروتوكول الفطري.");
    return res.redirect("/cadres/consult");
  }
  const db = getDb();
  try {
    const ai_response = await generateAiResponse(db, question);
    db.prepare(
      `INSERT INTO consultations (member_id, question, ai_response, status, created_at) VALUES (?, ?, ?, 'open', ?)`
    ).run(req.session.userId, question, ai_response, new Date().toISOString());
    flash(req, "success", "تم إنشاء الاستشارة.");
    res.redirect("/cadres/my-consultations");
  } catch (e) {
    console.error("[consult]", e);
    flash(req, "danger", "تعذّر معالجة الاستشارة.");
    res.redirect("/cadres/consult");
  } finally {
    db.close();
  }
});
app.get("/cadres/my-consultations", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const consultations = db
      .prepare("SELECT * FROM consultations WHERE member_id = ? ORDER BY created_at DESC")
      .all(req.session.userId);
    render(req, res, "cadres/my_consultations.html", { consultations });
  } finally {
    db.close();
  }
});
app.get("/cadres/knowledge/search", requireLogin, requireActive, (req, res) => {
  const q = req.query.q || "";
  const db = getDb();
  try {
    const results = q ? searchKnowledge(db, q) : [];
    render(req, res, "cadres/knowledge_search.html", { query: q, results });
  } finally {
    db.close();
  }
});
app.get("/cadres/panel", requireLogin, requireRoles("cadre", "admin"), (req, res) => {
  const db = getDb();
  try {
    const consultations = db
      .prepare(
        `SELECT c.*, u.username, u.full_name FROM consultations c
         JOIN users u ON c.member_id = u.id WHERE c.status = 'open' ORDER BY c.created_at DESC`
      )
      .all();
    render(req, res, "cadres/panel.html", { consultations });
  } finally {
    db.close();
  }
});
app.post("/cadres/panel/:cid/reply", requireLogin, requireRoles("cadre", "admin"), (req, res) => {
  const db = getDb();
  try {
    const profile = db.prepare("SELECT verified_signature FROM cadre_profiles WHERE user_id = ?").get(req.session.userId);
    const sig = profile?.verified_signature || "مستشار معتمد";
    const signed = `${req.body.cadre_response}\n\n— ${sig}`;
    db.prepare(
      `UPDATE consultations SET cadre_id = ?, cadre_response = ?, status = 'answered', answered_at = ? WHERE id = ?`
    ).run(req.session.userId, signed, new Date().toISOString(), req.params.cid);
    flash(req, "success", "تم إرسال الرد الموثّق.");
    res.redirect("/cadres/panel");
  } finally {
    db.close();
  }
});

app.get("/admin/knowledge", requireLogin, requireRoles("admin", "supervisor", "cadre"), (req, res) => {
  const db = getDb();
  try {
    reloadRag();
    const qa_rows = loadRagRows(true);
    const stats = {
      qa_count: qa_rows.length,
      articles: db.prepare("SELECT COUNT(*) as c FROM knowledge_articles").get().c,
      videos: db.prepare("SELECT COUNT(*) as c FROM videos WHERE is_published = 1").get().c,
    };
    render(req, res, "admin/knowledge.html", { qa_rows, stats, stages: ["التطهير", "الاستيقاظ", "الاعتصام", "سيادة والإنتاج"] });
  } finally {
    db.close();
  }
});

app.post("/admin/knowledge/add", requireLogin, requireRoles("admin", "supervisor", "cadre"), (req, res) => {
  const title = (req.body.title || "").trim();
  const content = (req.body.content || "").trim();
  const category = (req.body.category || "عام").trim();
  const tags = (req.body.tags || "").trim();
  const signature = (req.body.verified_signature || "").trim();
  const publish = req.body.is_published === "1" ? 1 : 0;

  if (!title || !content) {
    flash(req, "warning", "العنوان والمحتوى مطلوبان.");
    return res.redirect("/admin/knowledge");
  }

  const db = getDb();
  try {
    const profile = db.prepare("SELECT verified_signature FROM cadre_profiles WHERE user_id = ?").get(req.session.userId);
    const sig = signature || profile?.verified_signature || "مستشار معتمد — شفرة الفطرة";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO knowledge_articles (author_id, title, content, category, tags, verified_signature, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.session.userId, title, content, category, tags, sig, publish, now, now);
    flash(req, "success", publish ? "تم نشر المقال في أرشيف المعرفة." : "تم حفظ المقال (مسودة).");
    res.redirect("/admin/knowledge");
  } finally {
    db.close();
  }
});

app.get("/admin/knowledge/template", requireLogin, requireRoles("admin", "supervisor", "cadre"), (_req, res) => {
  const buf = buildAssistantTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="shifra-assistant-qa-template.xlsx"');
  res.send(buf);
});

app.post(
  "/admin/knowledge/import",
  requireLogin,
  requireRoles("admin", "supervisor", "cadre"),
  excelUpload.single("excel_file"),
  (req, res) => {
    if (!req.file) {
      flash(req, "warning", "اختر ملف Excel (.xlsx) صالح.");
      return res.redirect("/admin/knowledge");
    }

    const { rows, errors, format, articles } = parseAssistantWorkbook(req.file.buffer);
    if (!rows.length) {
      flash(req, "danger", errors.join(" ") || "لم تُستورد أي صفوف.");
      return res.redirect("/admin/knowledge");
    }

    try {
      const mode = req.body.import_mode === "replace" ? "replace" : "merge";
      const result =
        mode === "replace" ? replaceAssistantRows(rows) : mergeAssistantRows(rows, mode);
      let msg = `تم تحديث أرشيف المساعد: ${result.count} سجل (${result.imported} من الملف).`;
      if (format === "knowledge" && articles.length) {
        const db = getDb();
        try {
          const profile = db
            .prepare("SELECT verified_signature FROM cadre_profiles WHERE user_id = ?")
            .get(req.session.userId);
          const sig = profile?.verified_signature || "مستشار معتمد — شفرة الفطرة";
          const articleCount = importKnowledgeArticles(db, articles, req.session.userId, sig);
          msg += ` و${articleCount} مقال في أرشيف المعرفة.`;
        } finally {
          db.close();
        }
      }
      if (errors.length) msg += ` تحذير: ${errors.slice(0, 2).join("؛ ")}`;
      flash(req, errors.length ? "warning" : "success", msg);
      res.redirect("/admin/knowledge");
    } catch (e) {
      console.error(e);
      flash(req, "danger", "فشل حفظ بيانات المساعد.");
      res.redirect("/admin/knowledge");
    }
  }
);

app.post("/admin/knowledge/qa/add", requireLogin, requireRoles("admin", "supervisor", "cadre"), (req, res) => {
  const title = (req.body.title || "").trim();
  const stage = (req.body.stage || "التطهير").trim();
  const tags = (req.body.tags || "").trim();
  const user_question = (req.body.user_question || "").trim();
  const optimized_answer = (req.body.optimized_answer || "").trim();
  const slug = (req.body.slug || "").trim().toLowerCase();

  if (!title || !user_question || !optimized_answer || !slug) {
    flash(req, "warning", "جميع الحقول مطلوبة ما عدا id.");
    return res.redirect("/admin/knowledge");
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    flash(req, "warning", "slug: حروف إنجليزية وشرطات فقط.");
    return res.redirect("/admin/knowledge");
  }

  try {
    mergeAssistantRows(
      [{ id: "", title, stage, tags, user_question, optimized_answer, slug }],
      "merge"
    );
    flash(req, "success", "تمت إضافة سجل للمساعد.");
  } catch (e) {
    console.error(e);
    flash(req, "danger", "تعذّر الحفظ.");
  }
  res.redirect("/admin/knowledge");
});

app.get("/admin/knowledge/qa/:slug/edit", requireLogin, requireRoles("admin", "supervisor", "cadre"), (req, res) => {
  reloadRag();
  const row = loadRagRows(true).find((r) => r.slug === req.params.slug);
  if (!row) return render404(req, res);
  render(req, res, "admin/knowledge_qa_edit.html", {
    row,
    stages: ["التطهير", "الاستيقاظ", "الاعتصام", "سيادة والإنتاج"],
  });
});

app.post("/admin/knowledge/qa/:slug/edit", requireLogin, requireRoles("admin", "supervisor", "cadre"), (req, res) => {
  const oldSlug = req.params.slug;
  const title = (req.body.title || "").trim();
  const stage = (req.body.stage || "التطهير").trim();
  const tags = (req.body.tags || "").trim();
  const user_question = (req.body.user_question || "").trim();
  const optimized_answer = (req.body.optimized_answer || "").trim();
  const slug = (req.body.slug || "").trim().toLowerCase();

  if (!title || !user_question || !optimized_answer || !slug) {
    flash(req, "warning", "جميع الحقول مطلوبة.");
    return res.redirect(`/admin/knowledge/qa/${oldSlug}/edit`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    flash(req, "warning", "slug: حروف إنجليزية وشرطات فقط.");
    return res.redirect(`/admin/knowledge/qa/${oldSlug}/edit`);
  }

  try {
    const result = updateAssistantQaRow(oldSlug, {
      title,
      stage,
      tags,
      user_question,
      optimized_answer,
      slug,
    });
    if (!result.ok) {
      if (result.error === "slug_taken") {
        flash(req, "warning", "المعرّف slug مستخدم في سجل آخر.");
      } else {
        flash(req, "danger", "السجل غير موجود.");
      }
      return res.redirect(result.error === "not_found" ? "/admin/knowledge" : `/admin/knowledge/qa/${oldSlug}/edit`);
    }
    flash(req, "success", "تم تحديث السجل.");
    res.redirect("/admin/knowledge");
  } catch (e) {
    console.error(e);
    flash(req, "danger", "تعذّر الحفظ.");
    res.redirect(`/admin/knowledge/qa/${oldSlug}/edit`);
  }
});

app.post("/admin/knowledge/qa/:slug/delete", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  try {
    const slug = req.params.slug;
    const { writeRagCsv } = require("./lib/assistant-excel");
    const remaining = loadRagRows().filter((r) => r.slug !== slug);
    writeRagCsv(remaining);
    flash(req, "success", "تم حذف السجل.");
  } catch (e) {
    flash(req, "danger", "تعذّر الحذف.");
  }
  res.redirect("/admin/knowledge");
});

app.post("/admin/knowledge/:id/toggle", requireLogin, requireRoles("admin", "supervisor", "cadre"), (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare("SELECT is_published FROM knowledge_articles WHERE id = ?").get(req.params.id);
    if (!row) {
      flash(req, "danger", "المقال غير موجود.");
      return res.redirect("/admin/knowledge");
    }
    const next = row.is_published ? 0 : 1;
    db.prepare("UPDATE knowledge_articles SET is_published = ?, updated_at = ? WHERE id = ?").run(
      next,
      new Date().toISOString(),
      req.params.id
    );
    flash(req, "success", next ? "تم النشر." : "تم إلغاء النشر.");
    res.redirect("/admin/knowledge");
  } finally {
    db.close();
  }
});

app.post("/admin/knowledge/:id/delete", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    db.prepare("DELETE FROM knowledge_articles WHERE id = ?").run(req.params.id);
    flash(req, "success", "تم حذف المقال.");
    res.redirect("/admin/knowledge");
  } finally {
    db.close();
  }
});

// ——— Market ———
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const p = Math.PI / 180;
  const a =
    0.5 -
    Math.cos((lat2 - lat1) * p) / 2 +
    (Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lon2 - lon1) * p))) / 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

app.get("/market", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const { city, points } = listPointsForMember(db, req.session.userId);
    const productMap = productsByPointIds(
      db,
      points.map((p) => p.id)
    );
    const pointsWithProducts = points.map((p) => ({
      ...p,
      products: productMap[p.id] || [],
    }));
    render(req, res, "market/index.html", { points: pointsWithProducts, memberCity: city });
  } finally {
    db.close();
  }
});
app.get("/market/order", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const { city, points } = listPointsForMember(db, req.session.userId);
    render(req, res, "market/order.html", { points, memberCity: city });
  } finally {
    db.close();
  }
});
app.post("/market/order", requireLogin, requireActive, (req, res) => {
  const items = (req.body.items || "").trim();
  if (!items) {
    flash(req, "warning", "حدد احتياجاتك من الطيبات.");
    return res.redirect("/market/order");
  }
  const db = getDb();
  try {
    const { points } = listPointsForMember(db, req.session.userId);
    let point_id = req.body.point_id ? parseInt(req.body.point_id, 10) : null;
    if (point_id && !points.some((p) => p.id === point_id)) {
      flash(req, "warning", "السوق المختار غير متاح في مدينتك.");
      return res.redirect("/market/order");
    }
    const lat = parseFloat(req.body.lat);
    const lng = parseFloat(req.body.lng);
    if (lat && lng && !point_id) {
      let best = null,
        bestD = Infinity;
      points.forEach((p) => {
        if (p.lat && p.lng) {
          const d = haversine(lat, lng, p.lat, p.lng);
          if (d < bestD) {
            bestD = d;
            best = p.id;
          }
        }
      });
      point_id = best;
    }
    db.prepare(
      `INSERT INTO market_orders (user_id, items_json, notes, distribution_point_id, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    ).run(
      req.session.userId,
      JSON.stringify({ items }),
      req.body.notes,
      point_id,
      new Date().toISOString()
    );
    flash(req, "success", "تم إرسال طلبك إلى غرفة التحكم.");
    res.redirect("/market/my-orders");
  } finally {
    db.close();
  }
});
app.get("/market/my-orders", requireLogin, requireActive, (req, res) => {
  const db = getDb();
  try {
    const orders = db
      .prepare(
        `SELECT o.*, d.name as point_name, d.city FROM market_orders o
         LEFT JOIN distribution_points d ON o.distribution_point_id = d.id
         WHERE o.user_id = ? ORDER BY o.created_at DESC`
      )
      .all(req.session.userId);
    render(req, res, "market/my_orders.html", { orders });
  } finally {
    db.close();
  }
});
app.get("/market/manage", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const points = db.prepare("SELECT * FROM distribution_points ORDER BY city, name").all();
    const productMap = allProductsGrouped(db);
    render(req, res, "market/manage.html", { points, productMap });
  } finally {
    db.close();
  }
});
app.post("/market/manage/add", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const b = req.body;
  const name = (b.name || "").trim();
  const region = (b.region || "").trim();
  const city = (b.city || "").trim();
  if (!name || !region || !city) {
    flash(req, "warning", "اسم السوق والمنطقة والمدينة مطلوبة.");
    return res.redirect("/market/manage");
  }
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO distribution_points (name, region, city, address, lat, lng, contact_phone, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
    ).run(
      name,
      region,
      city,
      (b.address || "").trim(),
      b.lat ? parseFloat(b.lat) : null,
      b.lng ? parseFloat(b.lng) : null,
      (b.contact_phone || "").trim(),
      new Date().toISOString()
    );
    flash(req, "success", "تمت إضافة السوق.");
    res.redirect("/market/manage");
  } finally {
    db.close();
  }
});
app.post("/market/manage/:id/delete", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = getDb();
  try {
    db.prepare("DELETE FROM market_products WHERE point_id = ?").run(id);
    db.prepare("DELETE FROM distribution_points WHERE id = ?").run(id);
    flash(req, "success", "تم حذف السوق.");
  } catch (e) {
    flash(req, "danger", "تعذّر حذف السوق.");
  } finally {
    db.close();
  }
  res.redirect("/market/manage");
});
app.post("/market/manage/:id/products/add", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const pointId = parseInt(req.params.id, 10);
  const name = (req.body.name || "").trim();
  if (!name) {
    flash(req, "warning", "اسم المنتج مطلوب.");
    return res.redirect("/market/manage");
  }
  const db = getDb();
  try {
    const point = db.prepare("SELECT id FROM distribution_points WHERE id = ?").get(pointId);
    if (!point) {
      flash(req, "danger", "السوق غير موجود.");
      return res.redirect("/market/manage");
    }
    db.prepare(
      `INSERT INTO market_products (point_id, name, description, price_note, is_available, sort_order, created_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    ).run(
      pointId,
      name,
      (req.body.description || "").trim(),
      (req.body.price_note || "").trim(),
      parseInt(req.body.sort_order, 10) || 0,
      new Date().toISOString()
    );
    flash(req, "success", "تمت إضافة المنتج.");
  } finally {
    db.close();
  }
  res.redirect("/market/manage");
});
app.post("/market/manage/products/:id/delete", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    db.prepare("DELETE FROM market_products WHERE id = ?").run(req.params.id);
    flash(req, "success", "تم حذف المنتج.");
  } finally {
    db.close();
  }
  res.redirect("/market/manage");
});

// ——— Admin ———
app.get("/admin/applications", requireLogin, requirePermission("users", "read"), (req, res) => {
  const db = getDb();
  try {
    const pending = listPendingApplications(db);
    render(req, res, "admin/applications.html", { pending });
  } finally {
    db.close();
  }
});
app.post("/admin/applications/:id/approve", requireLogin, requirePermission("users", "write"), async (req, res) => {
  const targetId = parseUserId(req.params.id);
  if (!targetId) {
    flash(req, "danger", "معرّف غير صالح.");
    return res.redirect("/admin/applications");
  }
  const db = getDb();
  try {
    const r = await approveUser(db, targetId, parseSessionUserId(req.session), (req.body.note || "").trim());
    flash(req, r.ok ? "success" : "danger", r.ok ? "تم القبول وإرسال بريد الترحيب." : r.error);
  } finally {
    db.close();
  }
  res.redirect("/admin/applications");
});
app.post("/admin/applications/:id/reject", requireLogin, requirePermission("users", "write"), async (req, res) => {
  const targetId = parseUserId(req.params.id);
  const note = (req.body.note || "").trim();
  if (!targetId) {
    flash(req, "danger", "معرّف غير صالح.");
    return res.redirect("/admin/applications");
  }
  if (!note) {
    flash(req, "danger", "سبب الرفض مطلوب.");
    return res.redirect("/admin/applications");
  }
  const db = getDb();
  try {
    const r = await rejectUser(db, targetId, parseSessionUserId(req.session), note);
    flash(req, r.ok ? "success" : "danger", r.ok ? "تم الرفض وإرسال البريد." : r.error);
  } finally {
    db.close();
  }
  res.redirect("/admin/applications");
});

app.get("/admin/system", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const system = buildSystemChecks(db);
    const settings = getSettingsForm(db);
    const database = getDatabaseForm();
    const can_edit = req.session.role === "admin";
    render(req, res, "admin/system.html", {
      system,
      settings,
      database,
      can_edit,
      admin_nav: "system",
    });
  } finally {
    db.close();
  }
});

app.post("/admin/system", requireLogin, requireRoles("admin"), async (req, res) => {
  const db = getDb();
  try {
    if (req.body.action === "clear") {
      clearAppSettings(db);
      flash(req, "success", "أُزيلت إعدادات لوحة الإدارة — يُستخدم ما في Hostinger فقط.");
      return res.redirect("/admin/system");
    }
    if (req.body.action === "database_save") {
      const r = saveDatabaseSettings(req.body);
      flash(req, r.ok ? "success" : "danger", r.ok ? r.message : r.error);
      return res.redirect("/admin/system");
    }
    if (req.body.action === "database_test") {
      const r = testDatabaseConnection(req.body);
      flash(req, r.ok ? "success" : "danger", r.ok ? r.message : r.error);
      return res.redirect("/admin/system");
    }
    const r = saveAppSettings(db, req.body);
    if (!r.ok) {
      flash(req, "danger", r.error);
      return res.redirect("/admin/system");
    }
    flash(req, "success", "تم حفظ إعدادات البريد والموقع — جرّب إرسال بريد تأكيد أو «نسيت كلمة المرور».");
    res.redirect("/admin/system");
  } finally {
    db.close();
  }
});

app.get("/admin", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const presence = getPresenceStats(db);
    const stats = {
      users: presence.registered,
      registered: presence.registered,
      online: presence.online,
      online_minutes: presence.onlineMinutes,
      pending_posts: db.prepare("SELECT COUNT(*) as c FROM community_posts WHERE status = 'pending'").get().c,
      videos: db.prepare("SELECT COUNT(*) as c FROM videos").get().c,
      consultations: db.prepare("SELECT COUNT(*) as c FROM consultations WHERE status = 'open'").get().c,
      rated_members: db.prepare("SELECT COUNT(*) as c FROM users WHERE admin_stars IS NOT NULL").get().c,
      with_suggestions: db
        .prepare("SELECT COUNT(*) as c FROM users WHERE admin_suggestion IS NOT NULL AND TRIM(admin_suggestion) != ''")
        .get().c,
    };
    const geo = getLocationStats(db);
    const system = buildSystemChecks(db);
    render(req, res, "admin/dashboard.html", { stats, geo, system, admin_nav: "dashboard" });
  } finally {
    db.close();
  }
});
app.post("/admin/users/:id/approve", requireLogin, requirePermission("users", "write"), async (req, res) => {
  const targetId = parseUserId(req.params.id);
  if (!targetId) {
    flash(req, "danger", "معرّف العضو غير صالح.");
    return res.redirect("/admin/users");
  }
  const db = getDb();
  try {
    const r = await approveUser(db, targetId, parseSessionUserId(req.session), (req.body.note || "").trim());
    flash(req, r.ok ? "success" : "danger", r.ok ? "تم تفعيل العضو." : r.error);
  } finally {
    db.close();
  }
  res.redirect(safeReturnPath(req.body.return_to, "/admin/users"));
});
app.get("/admin/quiz-review", requireLogin, requirePermission("users", "read"), (req, res) => {
  const db = getDb();
  try {
    const queue = listQuizReviewQueue(db);
    render(req, res, "admin/quiz_review.html", { pending: queue });
  } finally {
    db.close();
  }
});
app.get("/admin/quiz-review/:id", requireLogin, requirePermission("users", "read"), (req, res) => {
  const targetId = parseUserId(req.params.id);
  if (!targetId) return res.redirect("/admin/quiz-review");
  const db = getDb();
  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId);
    if (!user) {
      flash(req, "danger", "المستخدم غير موجود.");
      return res.redirect("/admin/quiz-review");
    }
    const answers = getQuizAnswersForUser(db, targetId);
    render(req, res, "admin/quiz_user.html", { user, answers });
  } finally {
    db.close();
  }
});
app.post("/admin/quiz-review/:id/reject", requireLogin, requirePermission("users", "write"), (req, res) => {
  const targetId = parseUserId(req.params.id);
  const note = (req.body.note || "").trim();
  if (!targetId) {
    flash(req, "danger", "معرّف غير صالح.");
    return res.redirect("/admin/quiz-review");
  }
  const db = getDb();
  try {
    const r = rejectQuizRetry(db, targetId, parseSessionUserId(req.session), note);
    flash(req, r.ok ? "success" : "danger", r.ok ? "يمكن للعضو إعادة الاختبار." : r.error);
  } finally {
    db.close();
  }
  res.redirect(`/admin/quiz-review/${targetId}`);
});
app.get("/admin/users", requireLogin, requirePermission("users", "read"), (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const db = getDb();
  try {
    const presence = getPresenceStats(db);
    const rows = db.prepare(`SELECT * FROM users ORDER BY created_at DESC`).all();
    const totals = getPresenceTotalsForUsers(db, rows, presence.onlineMinutes);
    const me = currentUser(req);
    if (me && req.session) {
      req.session.role = me.role;
      req.session.userId = me.id;
    }
    render(req, res, "admin/users.html", {
      users: totals.users,
      presence: { ...presence, siteTotalSeconds: totals.siteTotalSeconds },
    });
  } finally {
    db.close();
  }
});
app.post("/admin/users/:id/rate", requireLogin, requireRoles("admin"), (req, res) => {
  const starsRaw = (req.body.stars || "").trim();
  const suggestion = (req.body.suggestion || "").trim();
  let stars = starsRaw === "" ? null : parseInt(starsRaw, 10);
  if (stars !== null && (!Number.isFinite(stars) || stars < 1 || stars > 5)) {
    flash(req, "danger", "التقييم يجب أن يكون من 1 إلى 5 نجوم.");
    return res.redirect("/admin/users");
  }
  const db = getDb();
  try {
    const target = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!target) return render404(req, res);
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users SET admin_stars = ?, admin_suggestion = ?, admin_rated_by = ?, admin_rated_at = ? WHERE id = ?`
    ).run(stars, suggestion || null, req.session.userId, now, req.params.id);
    flash(req, "success", "تم حفظ التقييم والمقترح.");
    res.redirect("/admin/users");
  } finally {
    db.close();
  }
});
app.post("/admin/users/:id/role", requireLogin, requirePermission("users", "write"), (req, res) => {
  const targetId = parseUserId(req.params.id);
  if (!targetId) {
    flash(req, "danger", "معرّف العضو غير صالح.");
    return res.redirect("/admin/users");
  }
  const db = getDb();
  try {
    const result = updateMemberRole(
      db,
      targetId,
      (req.body.role || "").trim(),
      parseSessionUserId(req.session),
      req.session.role
    );
    flash(req, result.ok ? "success" : "danger", result.ok ? "تم تحديث دور العضو." : result.error);
  } finally {
    db.close();
  }
  res.redirect("/admin/users");
});
app.post("/admin/users/:id/delete", requireLogin, requirePermission("users", "delete"), (req, res) => {
  const targetId = parseUserId(req.params.id);
  if (!targetId) {
    flash(req, "danger", "معرّف العضو غير صالح.");
    return res.redirect("/admin/users");
  }
  const db = getDb();
  try {
    const target = db.prepare("SELECT id, email FROM users WHERE id = ?").get(targetId);
    if (!target) return render404(req, res);
    const confirm = (req.body.confirm_email || "").trim().toLowerCase();
    if (confirm && confirm !== (target.email || "").toLowerCase()) {
      flash(req, "danger", "تأكيد البريد غير مطابق.");
      return res.redirect("/admin/users");
    }
    const result = deleteMemberAccount(db, targetId, parseSessionUserId(req.session));
    flash(
      req,
      result.ok ? "success" : "danger",
      result.ok
        ? "تم حذف الحساب وإنهاء جلساته — لن يبقى مسجّل دخولاً على أي جهاز."
        : result.error
    );
  } finally {
    db.close();
  }
  res.redirect("/admin/users");
});
app.get("/admin/nav-menus", requireLogin, requireRoles("admin"), (req, res) => {
  const role = (req.query.role || "member").trim();
  const activeRole = NAV_ROLES.includes(role) ? role : "member";
  const db = getDb();
  try {
    render(req, res, "admin/nav_menus.html", {
      nav_roles: NAV_ROLES,
      active_role: activeRole,
      nav_items: getRoleNavState(db, activeRole),
    });
  } finally {
    db.close();
  }
});
app.post("/admin/nav-menus", requireLogin, requireRoles("admin"), (req, res) => {
  const role = (req.body.role || "").trim();
  if (!NAV_ROLES.includes(role)) {
    flash(req, "danger", "دور غير صالح.");
    return res.redirect("/admin/nav-menus");
  }
  const db = getDb();
  try {
    const items = parseRoleNavBody(req.body, role);
    saveRoleNav(db, role, items);
    flash(req, "success", `تم حفظ قائمة التنقل لـ «${ROLE_LABELS[role] || role}».`);
  } finally {
    db.close();
  }
  res.redirect(`/admin/nav-menus?role=${encodeURIComponent(role)}`);
});
app.post("/admin/nav-menus/reset", requireLogin, requireRoles("admin"), (req, res) => {
  const role = (req.body.role || "").trim();
  const db = getDb();
  try {
    if (role === "__all__") {
      db.prepare("DELETE FROM role_nav_items").run();
      seedRoleNav(db);
      flash(req, "success", "أُعيدت جميع القوائم إلى الافتراضي.");
      return res.redirect("/admin/nav-menus");
    }
    if (!NAV_ROLES.includes(role)) {
      flash(req, "danger", "دور غير صالح.");
      return res.redirect("/admin/nav-menus");
    }
    db.prepare("DELETE FROM role_nav_items WHERE role = ?").run(role);
    seedRoleNav(db, role);
    flash(req, "success", "أُعيدت القائمة إلى الافتراضي.");
  } finally {
    db.close();
  }
  res.redirect(`/admin/nav-menus?role=${encodeURIComponent(role)}`);
});
app.get("/admin/audit-log", requireLogin, requireStaff(), (req, res) => {
  const db = getDb();
  try {
    const rows = db
      .prepare(
        `SELECT a.*, u.full_name AS actor_name, u.email AS actor_email
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC
         LIMIT 500`
      )
      .all();
    render(req, res, "admin/audit_log.html", { rows });
  } finally {
    db.close();
  }
});

app.get("/admin/permissions", requireLogin, requirePermission("permissions", "read"), (req, res) => {
  const db = getDb();
  try {
    const permissions = db.prepare("SELECT * FROM role_permissions ORDER BY role, resource").all();
    render(req, res, "admin/permissions.html", {
      permissions,
      resource_labels: RESOURCE_LABELS,
    });
  } finally {
    db.close();
  }
});
app.post("/admin/permissions/update", requireLogin, requirePermission("permissions", "write"), (req, res) => {
  const db = getDb();
  try {
    db.prepare("UPDATE role_permissions SET can_read = ?, can_write = ?, can_delete = ? WHERE id = ?").run(
      req.body.can_read ? 1 : 0,
      req.body.can_write ? 1 : 0,
      req.body.can_delete ? 1 : 0,
      req.body.perm_id
    );
    flash(req, "success", "تم تحديث الصلاحيات.");
    res.redirect("/admin/permissions");
  } finally {
    db.close();
  }
});
app.get("/admin/newsletter", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const history = db
      .prepare(
        `SELECT * FROM newsletters ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 20`
      )
      .all();
    const pushCount = db.prepare("SELECT COUNT(*) AS c FROM push_subscriptions").get().c;
    const preview = previewNextDose(db);
    render(req, res, "admin/newsletter.html", {
      history,
      pushCount,
      preview,
      autoEnabled: isAutoEnabled(db),
      intervalHours: getSetting(db, "interval_hours", "24"),
      lastSent: lastSentAt(db),
      vapidPublic: getPublicKey(),
    });
  } finally {
    db.close();
  }
});

app.post("/admin/newsletter/settings", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    setSetting(db, "auto_enabled", req.body.auto_enabled === "1" ? "1" : "0");
    const h = parseFloat(req.body.interval_hours);
    if (Number.isFinite(h) && h >= 1 && h <= 168) {
      setSetting(db, "interval_hours", String(h));
    }
    flash(req, "success", "تم حفظ إعدادات النشرة.");
    res.redirect("/admin/newsletter");
  } finally {
    db.close();
  }
});

app.post("/admin/newsletter/send-auto", requireLogin, requireRoles("admin", "supervisor"), async (req, res) => {
  const db = getDb();
  try {
    const result = await publishDose(db, { createdBy: req.session.userId, autoGenerated: 1 });
    if (!result.ok) {
      flash(req, "warning", result.error);
    } else {
      flash(
        req,
        "success",
        `جرعة وعي: «${result.dose.subject}» — بريد ${result.emailsOk} · إشعار PWA ${result.push.sent}/${result.push.total}`
      );
    }
    res.redirect("/admin/newsletter");
  } finally {
    db.close();
  }
});

app.post("/admin/newsletter", requireLogin, requireRoles("admin", "supervisor"), async (req, res) => {
  const subject = (req.body.subject || "").trim();
  const content = (req.body.content || "").trim();
  if (!subject || !content) {
    flash(req, "warning", "الموضوع والمحتوى مطلوبان.");
    return res.redirect("/admin/newsletter");
  }
  const db = getDb();
  try {
    const result = await publishDose(db, {
      createdBy: req.session.userId,
      autoGenerated: 0,
      dose: {
        subject,
        content,
        source_type: "manual",
        source_ref: `manual:${Date.now()}`,
        link_url: (req.body.link_url || "").trim() || "/",
      },
    });
    if (!result.ok) {
      flash(req, "warning", result.error);
    } else {
      flash(
        req,
        "success",
        `تم إرسال الجرعة — بريد ${result.emailsOk} · إشعار ${result.push.sent}/${result.push.total}`
      );
    }
    res.redirect("/admin/newsletter");
  } finally {
    db.close();
  }
});

app.get("/api/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: getPublicKey() });
});

app.post("/api/push/subscribe", requireLogin, (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh) {
    return res.status(400).json({ error: "subscription_invalid" });
  }
  const db = getDb();
  try {
    saveSubscription(db, req.session.userId, sub);
    res.json({ ok: true });
  } finally {
    db.close();
  }
});

app.get("/api/digest/latest", (req, res) => {
  const db = getDb();
  try {
    const row = db
      .prepare(
        `SELECT id, subject, content, link_url, source_type, sent_at, created_at
         FROM newsletters ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1`
      )
      .get();
    res.json(row || null);
  } finally {
    db.close();
  }
});

app.get("/api/digest/check", (req, res) => {
  const since = req.query.since;
  const db = getDb();
  try {
    const row = db
      .prepare(
        `SELECT id, subject, content, link_url, sent_at FROM newsletters
         ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1`
      )
      .get();
    if (!row) return res.json({ hasNew: false });
    const t = row.sent_at || row.created_at;
    const hasNew = !since || (t && t > since);
    res.json({ hasNew, dose: hasNew ? row : null });
  } finally {
    db.close();
  }
});
app.get("/admin/library/manage", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const videos = db
      .prepare(
        `SELECT v.*, c.name_ar as cat_name, c.slug as cat_slug, l.name_ar as level_name
         FROM videos v
         JOIN library_categories c ON v.category_id = c.id
         JOIN library_levels l ON c.level_id = l.id
         ORDER BY v.created_at DESC`
      )
      .all();
    const categories = db
      .prepare(
        `SELECT c.*, l.name_ar as level_name FROM library_categories c
         JOIN library_levels l ON c.level_id = l.id ORDER BY l.level_number, c.sort_order, c.name_ar`
      )
      .all();
    const segments = db
      .prepare(
        `SELECT s.id, s.video_id, s.start_seconds, s.end_seconds, s.text,
                v.title AS video_title
         FROM video_transcript_segments s
         JOIN videos v ON v.id = s.video_id
         ORDER BY s.video_id ASC, s.start_seconds ASC`
      )
      .all();
    const stats = {
      videos: videos.length,
      published: videos.filter((v) => v.is_published).length,
      segments: segments.length,
    };
    render(req, res, "admin/library_manage.html", {
      videos,
      categories,
      segments,
      stats,
      topic_packs: listTopicPacks(),
    });
  } finally {
    db.close();
  }
});

app.get("/admin/library/template", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const categories = db
      .prepare(
        `SELECT c.id, c.slug, c.name_ar, c.level_id, l.name_ar AS level_name, l.level_number
         FROM library_categories c
         JOIN library_levels l ON c.level_id = l.id
         ORDER BY l.level_number, c.sort_order, c.name_ar`
      )
      .all();
    const buf = buildLibraryTemplate(categories);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="shifra-library-import-template.xlsx"'
    );
    res.send(buf);
  } finally {
    db.close();
  }
});

app.get("/admin/library/template/:topic", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const categories = db
      .prepare(
        `SELECT c.id, c.slug, c.name_ar, c.level_id, l.name_ar AS level_name, l.level_number
         FROM library_categories c
         JOIN library_levels l ON c.level_id = l.id
         ORDER BY l.level_number, c.sort_order, c.name_ar`
      )
      .all();
    const buf = buildTopicTemplateBuffer(req.params.topic, categories);
    if (!buf) {
      flash(req, "warning", "موضوع القالب غير موجود.");
      return res.redirect("/admin/library/manage");
    }
    const filename = `shifra-library-${req.params.topic}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buf);
  } finally {
    db.close();
  }
});

app.post(
  "/admin/library/import",
  requireLogin,
  requireRoles("admin", "supervisor"),
  excelUpload.single("excel_file"),
  (req, res) => {
    if (!req.file) {
      flash(req, "warning", "اختر ملف Excel (.xlsx).");
      return res.redirect("/admin/library/manage");
    }
    const { videos, segments, errors } = parseLibraryWorkbook(req.file.buffer);
    if (!videos.length) {
      flash(req, "danger", errors.join(" ") || "لم تُستورد فيديوهات.");
      return res.redirect("/admin/library/manage");
    }
    const db = getDb();
    try {
      const { imported, errors: importErrors } = importLibrary(db, videos, segments);
      let msg = `تم استيراد ${imported} فيديو إلى المكتبة.`;
      const allErr = [...errors, ...importErrors];
      if (allErr.length) msg += ` (${allErr.slice(0, 2).join("؛ ")})`;
      flash(req, allErr.length ? "warning" : "success", msg);
      res.redirect("/admin/library/manage");
    } finally {
      db.close();
    }
  }
);

app.post(
  "/admin/library/add",
  requireLogin,
  requireRoles("admin", "supervisor"),
  videoUpload.single("video_file"),
  (req, res) => {
    const title = (req.body.title || "").trim();
    const categoryId = parseInt(req.body.category_id, 10);
    if (!title || !categoryId) {
      flash(req, "warning", "العنوان والتصنيف مطلوبان.");
      return res.redirect("/admin/library/manage");
    }
    const now = new Date().toISOString();
    const db = getDb();
    try {
      const relPath = req.file ? `videos/${req.file.filename}` : null;
      let durationSeconds = parseInt(req.body.duration_seconds, 10) || 0;
      if (req.file) {
        const extracted = getVideoDurationSeconds(path.join(VIDEOS_DIR, req.file.filename));
        if (extracted) durationSeconds = extracted;
      }
      db.prepare(
        `INSERT INTO videos (category_id, title, description, video_path, youtube_url, duration_seconds, transcript_text, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        categoryId,
        title,
        (req.body.description || "").trim(),
        relPath,
        (req.body.youtube_url || "").trim() || null,
        durationSeconds,
        (req.body.transcript_text || "").trim(),
        req.body.is_published === "1" ? 1 : 0,
        now,
        now
      );
      const vid = db.prepare("SELECT last_insert_rowid() AS id").get().id;
      const transcript = (req.body.transcript_text || "").trim();
      if (transcript) {
        db.prepare(
          `INSERT INTO video_transcript_segments (video_id, start_seconds, end_seconds, text) VALUES (?, 0, ?, ?)`
        ).run(vid, durationSeconds || 60, transcript);
      }
      let msg = "تمت إضافة الفيديو للمكتبة.";
      if (req.file && durationSeconds) {
        msg += ` المدة المستخرجة من الملف: ${formatDuration(durationSeconds)}.`;
      } else if (req.file) {
        msg += " تعذّر استخراج المدة — أدخلها يدوياً من التعديل.";
      }
      flash(req, "success", msg);
      res.redirect("/admin/library/manage");
    } finally {
      db.close();
    }
  }
);

const LIBRARY_ADMIN = "/admin/library/manage";

app.get("/admin/library/video/:id/edit", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const video = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
    if (!video) return render404(req, res);
    const categories = db
      .prepare(
        `SELECT c.*, l.name_ar AS level_name FROM library_categories c
         JOIN library_levels l ON c.level_id = l.id ORDER BY l.level_number, c.sort_order, c.name_ar`
      )
      .all();
    render(req, res, "admin/library_video_edit.html", { video, categories });
  } finally {
    db.close();
  }
});

app.post(
  "/admin/library/video/:id/edit",
  requireLogin,
  requireRoles("admin", "supervisor"),
  videoUpload.single("video_file"),
  (req, res) => {
    const title = (req.body.title || "").trim();
    const categoryId = parseInt(req.body.category_id, 10);
    if (!title || !categoryId) {
      flash(req, "warning", "العنوان والتصنيف مطلوبان.");
      return res.redirect(`/admin/library/video/${req.params.id}/edit`);
    }
    const now = new Date().toISOString();
    const db = getDb();
    try {
      const existing = db.prepare("SELECT * FROM videos WHERE id = ?").get(req.params.id);
      if (!existing) return render404(req, res);
      let videoPath = existing.video_path;
      if (req.file) {
        if (existing.video_path) {
          const oldPath = path.join(UPLOADS_DIR, existing.video_path);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        videoPath = `videos/${req.file.filename}`;
      }
      const removeFile = req.body.remove_video_file === "1";
      if (removeFile && videoPath) {
        const fp = path.join(UPLOADS_DIR, videoPath);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
        videoPath = null;
      }
      let durationSeconds = parseInt(req.body.duration_seconds, 10) || existing.duration_seconds || 0;
      if (req.file) {
        const extracted = getVideoDurationSeconds(path.join(VIDEOS_DIR, req.file.filename));
        if (extracted) durationSeconds = extracted;
      }
      db.prepare(
        `UPDATE videos SET category_id = ?, title = ?, description = ?, video_path = ?, youtube_url = ?,
         duration_seconds = ?, transcript_text = ?, sort_order = ?, is_published = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        categoryId,
        title,
        (req.body.description || "").trim(),
        videoPath,
        (req.body.youtube_url || "").trim() || null,
        durationSeconds,
        (req.body.transcript_text || "").trim(),
        parseInt(req.body.sort_order, 10) || 0,
        req.body.is_published === "1" ? 1 : 0,
        now,
        req.params.id
      );
      let msg = "تم تحديث الفيديو.";
      if (req.file && durationSeconds) {
        msg += ` المدة المستخرجة من الملف: ${formatDuration(durationSeconds)}.`;
      } else if (req.file) {
        msg += " تعذّر استخراج المدة — عدّلها يدوياً.";
      }
      flash(req, "success", msg);
      res.redirect(LIBRARY_ADMIN);
    } finally {
      db.close();
    }
  }
);

app.post("/admin/library/segments/add", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const videoId = parseInt(req.body.video_id, 10);
  const start = parseFloat(req.body.start_seconds);
  const end = parseFloat(req.body.end_seconds);
  const text = (req.body.text || "").trim();
  if (!videoId || !text) {
    flash(req, "warning", "اختر الفيديو وأدخل النص.");
    return res.redirect(LIBRARY_ADMIN);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    flash(req, "warning", "تحقق من وقت البداية والنهاية (بالثواني).");
    return res.redirect(LIBRARY_ADMIN);
  }
  const db = getDb();
  try {
    const v = db.prepare("SELECT id FROM videos WHERE id = ?").get(videoId);
    if (!v) {
      flash(req, "danger", "الفيديو غير موجود.");
      return res.redirect(LIBRARY_ADMIN);
    }
    db.prepare(
      `INSERT INTO video_transcript_segments (video_id, start_seconds, end_seconds, text) VALUES (?, ?, ?, ?)`
    ).run(videoId, start, end, text);
    flash(req, "success", "تمت إضافة المقطع النصي.");
    res.redirect(LIBRARY_ADMIN);
  } finally {
    db.close();
  }
});

app.post("/admin/library/segments/:id/update", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const videoId = parseInt(req.body.video_id, 10);
  const start = parseFloat(req.body.start_seconds);
  const end = parseFloat(req.body.end_seconds);
  const text = (req.body.text || "").trim();
  if (!videoId || !text) {
    flash(req, "warning", "الفيديو والنص مطلوبان.");
    return res.redirect(LIBRARY_ADMIN);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    flash(req, "warning", "تحقق من وقت البداية والنهاية.");
    return res.redirect(LIBRARY_ADMIN);
  }
  const db = getDb();
  try {
    const row = db.prepare("SELECT id FROM video_transcript_segments WHERE id = ?").get(req.params.id);
    if (!row) {
      flash(req, "danger", "المقطع غير موجود.");
      return res.redirect(LIBRARY_ADMIN);
    }
    db.prepare(
      `UPDATE video_transcript_segments SET video_id = ?, start_seconds = ?, end_seconds = ?, text = ? WHERE id = ?`
    ).run(videoId, start, end, text, req.params.id);
    flash(req, "success", "تم تحديث المقطع.");
    res.redirect(LIBRARY_ADMIN);
  } finally {
    db.close();
  }
});

app.post("/admin/library/segments/:id/delete", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    db.prepare("DELETE FROM video_transcript_segments WHERE id = ?").run(req.params.id);
    flash(req, "success", "تم حذف المقطع النصي.");
    res.redirect(LIBRARY_ADMIN);
  } finally {
    db.close();
  }
});

app.post("/admin/library/:id/toggle", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare("SELECT is_published FROM videos WHERE id = ?").get(req.params.id);
    if (!row) {
      flash(req, "danger", "الفيديو غير موجود.");
      return res.redirect(LIBRARY_ADMIN);
    }
    const next = row.is_published ? 0 : 1;
    db.prepare("UPDATE videos SET is_published = ?, updated_at = ? WHERE id = ?").run(
      next,
      new Date().toISOString(),
      req.params.id
    );
    flash(req, "success", next ? "تم إظهار الفيديو في المكتبة." : "تم إخفاء الفيديو من المكتبة.");
    res.redirect(LIBRARY_ADMIN);
  } finally {
    db.close();
  }
});

app.post("/admin/library/:id/delete", requireLogin, requireRoles("admin", "supervisor"), (req, res) => {
  const db = getDb();
  try {
    const v = db.prepare("SELECT video_path FROM videos WHERE id = ?").get(req.params.id);
    if (v?.video_path) {
      const fp = path.join(UPLOADS_DIR, v.video_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.prepare("DELETE FROM videos WHERE id = ?").run(req.params.id);
    flash(req, "success", "تم حذف الفيديو.");
    res.redirect(LIBRARY_ADMIN);
  } finally {
    db.close();
  }
});

// ——— Designer ———
const THEME_KEYS = [
  ["site_name", "اسم المنصة"],
  ["site_subtitle", "العنوان الفرعي"],
  ["logo_text", "نص الشعار"],
  ["hero_tagline", "شعار الصفحة الرئيسية"],
  ["primary_color", "اللون الذهبي"],
  ["secondary_color", "لون الخلفية"],
  ["accent_color", "لون التمييز"],
  ["background_gradient", "تدرج الخلفية"],
  ["font_family", "الخط"],
];

app.get("/designer", requireLogin, requireRoles("designer", "admin"), (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare("SELECT key, value FROM theme_settings").all();
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    render(req, res, "designer/studio.html", { settings, theme_keys: THEME_KEYS });
  } finally {
    db.close();
  }
});
app.post("/designer/save", requireLogin, requireRoles("designer", "admin"), (req, res) => {
  const now = new Date().toISOString();
  const db = getDb();
  try {
    const stmt = db.prepare(
      `INSERT INTO theme_settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
    );
    THEME_KEYS.forEach(([key]) => {
      if (req.body[key] !== undefined) stmt.run(key, req.body[key], now, req.session.userId);
    });
    flash(req, "success", "تم تحديث تصميم المنصة.");
    res.redirect("/designer");
  } finally {
    db.close();
  }
});

app.get("/health", (_req, res) => {
  const db = getDb();
  try {
    const { cfg } = require("./lib/app-config").getAppConfig(db);
    const { loadDatabaseConfig, mysqlConfigured } = require("./lib/database-config");
    const dbCfg = loadDatabaseConfig();
    res.json({
      ok: true,
      env: process.env.NODE_ENV || "development",
      db_driver: getDriver(),
      mysql: dbCfg.driver === "mysql" ? mysqlConfigured(dbCfg) : null,
      smtp: smtpConfigured(db),
      site_url: cfg.SITE_URL || null,
    });
  } finally {
    db.close();
  }
});

registerInstallPageRoute(app, render);

app.use((req, res) => {
  render404(req, res);
});

validateProductionConfig();

// Hostinger / منصات Node المُدارة: لا تضبط BIND_HOST أو استخدم 0.0.0.0 (انظر deploy/HOSTINGER.md)
const HOST =
  process.env.BIND_HOST ||
  (isProduction() || process.env.HOSTINGER === "1" ? "0.0.0.0" : "0.0.0.0");
  reloadRag();
  if (!smtpConfigured()) {
    console.warn(
      "  ⚠ SMTP غير مُعدّ — لن تُرسل رسائل (تأكيد بريد / نسيان كلمة المرور / النشرة). عيّن SMTP_* في .env"
    );
  } else {
    console.log("  ✓ SMTP مفعّل —", process.env.SMTP_HOST);
  }
  app.listen(PORT, HOST, () => {
  startMemberScheduler();
  startNewsletterScheduler();
  console.log("");
  console.log("  ✦ شفرة الفطرة ✦");
  const site = process.env.SITE_URL || `http://127.0.0.1:${PORT}`;
  console.log(`  ${site}`);
  console.log(`  ${site}/install — شرح تثبيت التطبيق`);
  if (!isProduction()) {
    console.log("  admin / admin123  |  designer / designer123");
  } else {
    console.log("  وضع الإنتاج — غيّر كلمات مرور الإدارة فوراً");
  }
  console.log("");
});
}

dbReady()
  .then(() => {
    initDb();
    const dbBoot = getDb();
    try {
      const n = runAutoActivationGrace(dbBoot);
      if (n > 0) console.log(`[members] تفعيل تلقائي عند الإقلاع: ${n} حساب`);
    } finally {
      dbBoot.close();
    }
    main();
  })
  .catch((err) => {
    console.error("\n❌ فشل تشغيل قاعدة البيانات:", err.message || err);
    process.exit(1);
  });
