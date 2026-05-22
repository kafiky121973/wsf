/**
 * مسارات الصفحات ومسار التصفح (breadcrumbs)
 */
const { urlFor, ROUTES } = require("./urls");

/** مسارات ثابتة → عنوان عربي */
const PATH_LABELS = {
  "/": "الرئيسية",
  "/auth/login": "دخول",
  "/auth/forgot-password": "نسيت كلمة المرور",
  "/auth/reset-password": "كلمة مرور جديدة",
  "/join/verify-sent": "تأكيد البريد",
  "/join": "انضمام",
  "/join/account": "إنشاء حساب",
  "/join/status": "حالة الحساب",
  "/profile/location": "تحديث الموقع",
  "/gallery": "معرض الشهادات",
  "/library": "مكتبة الوعي",
  "/library/search": "بحث المكتبة",
  "/community": "مجتمع الخلفاء",
  "/community/journal": "يومياتي",
  "/community/journal/new": "يومية جديدة",
  "/community/submit": "رفع شهادة",
  "/community/moderation": "مراجعة المجتمع",
  "/cadres": "مساعدك",
  "/cadres/consult": "استشارة",
  "/cadres/my-consultations": "استشاراتي",
  "/cadres/knowledge/search": "بحث المعرفة",
  "/cadres/panel": "لوحة الكادر",
  "/market": "سوق الطيبات",
  "/market/order": "طلب جديد",
  "/market/my-orders": "طلباتي",
  "/market/manage": "إدارة الأسواق",
  "/admin": "لوحة الإدارة",
  "/admin/system": "إعدادات السيرفر",
  "/admin/users": "إدارة الأعضاء",
  "/install": "تثبيت التطبيق",
  "/admin/permissions": "الصلاحيات",
  "/admin/newsletter": "جرعات الوعي",
  "/admin/owner-messages": "مراسلة الأعضاء",
  "/owner": "مقترحاتكم",
  "/admin/library/manage": "إدارة المكتبة",
  "/admin/knowledge": "أرشيف المعرفة",
  "/designer": "استوديو المصمم",
};

/** قواعد مسارات ديناميكية (regex → دالة تُرجع ذيل المسار) */
const DYNAMIC_RULES = [
  {
    re: /^\/library\/search$/,
    tail: (_m, ctx) => [
      { label: PATH_LABELS["/library"], url: "/library" },
      {
        label: ctx.query && String(ctx.query).trim() ? `بحث: ${String(ctx.query).trim()}` : PATH_LABELS["/library/search"],
        url: null,
      },
    ],
  },
  {
    re: /^\/library\/level\/(\d+)$/,
    tail: (m, ctx) => [
      { label: PATH_LABELS["/library"], url: "/library" },
      { label: ctx.level?.name_ar || `المستوى ${m[1]}`, url: null },
    ],
  },
  {
    re: /^\/library\/video\/(\d+)$/,
    tail: (m, ctx) => [
      { label: PATH_LABELS["/library"], url: "/library" },
      ...(ctx.video?.level_number
        ? [{ label: ctx.video.level_name || `المستوى ${ctx.video.level_number}`, url: `/library/level/${ctx.video.level_number}` }]
        : []),
      { label: ctx.video?.title || `فيديو ${m[1]}`, url: null },
    ],
  },
  {
    re: /^\/gallery\/(\d+)$/,
    tail: (m, ctx) => [
      { label: PATH_LABELS["/gallery"], url: "/gallery" },
      { label: ctx.post?.title || `شهادة ${m[1]}`, url: null },
    ],
  },
  {
    re: /^\/community\/journal\/(\d+)$/,
    tail: (m, ctx) => [
      { label: PATH_LABELS["/community"], url: "/community" },
      { label: PATH_LABELS["/community/journal"], url: "/community/journal" },
      { label: ctx.entry?.title || `يومية ${m[1]}`, url: null },
    ],
  },
  {
    re: /^\/community\/journal\/(\d+)\/edit$/,
    tail: (m, ctx) => [
      { label: PATH_LABELS["/community"], url: "/community" },
      { label: PATH_LABELS["/community/journal"], url: "/community/journal" },
      { label: "تعديل يومية", url: `/community/journal/${m[1]}` },
      { label: ctx.entry?.title || m[1], url: null },
    ],
  },
  {
    re: /^\/admin\/knowledge\/qa\/([^/]+)\/edit$/,
    tail: (m, ctx) => [
      { label: PATH_LABELS["/admin"], url: "/admin" },
      { label: PATH_LABELS["/admin/knowledge"], url: "/admin/knowledge" },
      { label: ctx.row?.title || m[1], url: null },
    ],
  },
  {
    re: /^\/admin\/library\/video\/(\d+)\/edit$/,
    tail: (m, ctx) => [
      { label: PATH_LABELS["/admin"], url: "/admin" },
      { label: PATH_LABELS["/admin/library/manage"], url: "/admin/library/manage" },
      { label: ctx.video?.title ? `تعديل: ${ctx.video.title}` : `تعديل فيديو ${m[1]}`, url: null },
    ],
  },
];

function homeCrumb() {
  return { label: PATH_LABELS["/"], url: "/" };
}

function crumbsFromStaticPath(pathname) {
  if (pathname === "/") return [{ label: PATH_LABELS["/"], url: null }];

  const segments = pathname.split("/").filter(Boolean);
  const items = [homeCrumb()];
  let acc = "";

  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    const label = PATH_LABELS[acc];
    if (!label) continue;
    items.push({ label, url: isLast ? null : acc });
  }

  if (items.length > 1 && items[items.length - 1].url !== null) {
    items[items.length - 1].url = null;
  }
  return items.length > 1 ? items : null;
}

/**
 * @param {import('express').Request} req
 * @param {object} ctx سياق القالب (video, level, post, …)
 * @returns {{ label: string, url: string|null }[]|null}
 */
function buildBreadcrumbs(req, ctx = {}) {
  if (ctx.hide_breadcrumb) return null;
  if (Array.isArray(ctx.breadcrumbs) && ctx.breadcrumbs.length) return ctx.breadcrumbs;

  const pathname = (req.path || "/").split("?")[0];

  for (const rule of DYNAMIC_RULES) {
    const m = pathname.match(rule.re);
    if (m) return [homeCrumb(), ...rule.tail(m, ctx)];
  }

  return crumbsFromStaticPath(pathname);
}

module.exports = {
  PATH_LABELS,
  ROUTES,
  urlFor,
  buildBreadcrumbs,
};
