const { sendMail, SITE_NAME, loginUrl } = require("./mail");
const { getAppConfig } = require("./app-config");
const { createAuthToken, TOKEN_TYPES, invalidateTokensForUser } = require("./auth-tokens");

function authLink(path, token, db) {
  const base = loginUrl(db);
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function emailVerifyTtlMinutes(db) {
  const { cfg } = getAppConfig(db);
  const n = parseInt(cfg.EMAIL_VERIFY_TTL_MINUTES || "30", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

async function sendVerifyEmail(db, user) {
  invalidateTokensForUser(db, user.id, TOKEN_TYPES.EMAIL_VERIFY);
  const raw = createAuthToken(db, user.id, TOKEN_TYPES.EMAIL_VERIFY);
  const url = authLink("/auth/verify-email", raw, db);
  const ttl = emailVerifyTtlMinutes(db);
  const name = user.full_name || user.email.split("@")[0];
  const html = `<div dir="rtl" style="font-family:Segoe UI,Tahoma,sans-serif;line-height:1.9;max-width:36em;">
<h2 style="color:#8B6914;">تأكيد بريدك — ${SITE_NAME}</h2>
<p>السلام عليكم ${name}،</p>
<p>اضغط الرابط في هذه الرسالة للدخول <strong>مباشرة</strong> — لا حاجة لموافقة الإدارة:</p>
<p style="text-align:center;margin:1.5em 0;">
<a href="${url}" style="display:inline-block;padding:12px 24px;background:#8B6914;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">تأكيد البريد والدخول</a>
</p>
<p style="font-size:0.95em;word-break:break-all;">أو انسخ الرابط إلى المتصفح:<br><a href="${url}" style="color:#8B6914;">${url}</a></p>
<p style="font-size:0.9em;color:#666;">الرابط صالح <strong>${ttl} دقيقة</strong> فقط. التفعيل يتم <strong>بالضغط على الرابط</strong> — لا تفعيل تلقائي. بعد انتهاء المدة اطلب رابطاً جديداً.</p>
<p style="font-size:0.9em;color:#666;">تحقق من مجلد «البريد المزعج» إن لم تجد الرسالة.</p>
<p style="color:#666;">— فريق ${SITE_NAME}</p>
</div>`;
  const text = [
    `تأكيد بريدك — ${SITE_NAME}`,
    "",
    `السلام عليكم ${name}،`,
    "",
    "اضغط الرابط في هذه الرسالة للدخول مباشرة — لا حاجة لموافقة الإدارة:",
    "",
    url,
    "",
    `الرابط صالح ${ttl} دقيقة فقط. التفعيل بالضغط على الرابط — لا تفعيل تلقائي.`,
    "",
    "تحقق من مجلد «البريد المزعج» إن لم تجد الرسالة.",
    "",
    `— فريق ${SITE_NAME}`,
  ].join("\n");
  return sendMail({
    db,
    to: user.email,
    subject: `أكّد بريدك — ${SITE_NAME}`,
    html,
    text,
    logUrl: url,
  });
}

async function sendPasswordResetEmail(db, user) {
  invalidateTokensForUser(db, user.id, TOKEN_TYPES.PASSWORD_RESET);
  const raw = createAuthToken(db, user.id, TOKEN_TYPES.PASSWORD_RESET);
  const url = authLink("/auth/reset-password", raw, db);
  const name = user.full_name || user.email.split("@")[0];
  const html = `<div dir="rtl" style="font-family:Segoe UI,Tahoma,sans-serif;line-height:1.9;">
<h2 style="color:#8B6914;">استعادة كلمة المرور — ${SITE_NAME}</h2>
<p>السلام عليكم ${name}،</p>
<p>طُلب إعادة تعيين كلمة المرور. اضغط الرابط لتعيين كلمة جديدة:</p>
<p><a href="${url}" style="color:#8B6914;font-weight:bold;">تعيين كلمة مرور جديدة</a></p>
<p style="font-size:0.9em;color:#666;">صالح ساعتين فقط. إن لم تطلب ذلك تجاهل الرسالة.</p>
<p style="color:#666;">— فريق ${SITE_NAME}</p>
</div>`;
  return sendMail({
    db,
    to: user.email,
    subject: `استعادة كلمة المرور — ${SITE_NAME}`,
    html,
    text: `رابط إعادة التعيين: ${url}\n\nصالح ساعتين.`,
    logUrl: url,
  });
}

module.exports = { sendVerifyEmail, sendPasswordResetEmail, authLink };
