const fs = require("fs");
const path = require("path");
const { getAppConfig, smtpConfigured: cfgSmtpOk, siteUrl, mailFromDisplay: cfgMailFrom } = require("./app-config");

const YOUTUBE_URL =
  process.env.YOUTUBE_CHANNEL_URL || "https://www.youtube.com/results?search_query=شفرة+الفطرة";

const SITE_NAME = "شفرة الفطرة";

function resolveDb(db) {
  if (db) return { db, close: false };
  const { getDb } = require("./db");
  return { db: getDb(), close: true };
}

function smtpConfigured(db) {
  return cfgSmtpOk(getAppConfig(db));
}

function mailFromDisplay(db) {
  return cfgMailFrom(getAppConfig(db));
}

function loginUrl(db) {
  return siteUrl(getAppConfig(db));
}

/** رسالة فلاش بعد محاولة إرسال */
function mailFlashMessage(mailResult, { successMessage, isProduction }) {
  if (mailResult?.ok) {
    return { type: "success", message: successMessage };
  }
  if (mailResult?.status === "console") {
    return {
      type: "warning",
      message: isProduction
        ? "البريد غير مُفعّل. عيّن SMTP من /admin/system أو Environment Variables في Hostinger ثم أعد التشغيل."
        : "SMTP غير مُعدّ محلياً — الرابط يُطبع في الطرفية وفي data/email_log.txt أو عيّنه من /admin/system",
    };
  }
  return {
    type: "danger",
    message: `تعذّر إرسال البريد${mailResult?.error ? ": " + mailResult.error : ""}. راجع /admin/system`,
  };
}

function youtubeBlock() {
  return `اطلع على فيديوهات «شفرة الفطرة» على يوتيوب لتتعمّق في المنهج قبل أن تكتمل رحلتك مع المجتمع:

${YOUTUBE_URL}

ننصحك بمشاهدة المحتوى بجدية — فهو أساس الوعي الذي يُبنى عليه الحصن.`;
}

function welcomeEmailHtml(name, baseUrl) {
  const yt = youtubeBlock().replace(/\n/g, "<br>");
  return `<div dir="rtl" style="font-family:Segoe UI,Tahoma,sans-serif;line-height:1.9;">
<h2 style="color:#8B6914;">أهلاً بك في الحصن — ${SITE_NAME}</h2>
<p>السلام عليكم ${name || "أخي"}،</p>
<p>تم <strong>تفعيل حسابك</strong> بعد تأكيد بريدك — يمكنك الدخول مباشرة:</p>
<p><a href="${baseUrl}/auth/login">${baseUrl}/auth/login</a></p>
<p>استخدم بريدك الإلكتروني وكلمة المرور التي سجّلتَ بها.</p>
<hr><p>${yt}</p>
<p style="color:#666;">— فريق ${SITE_NAME}</p>
</div>`;
}

function rejectedEmailHtml(name, note) {
  const yt = youtubeBlock().replace(/\n/g, "<br>");
  return `<div dir="rtl" style="font-family:Segoe UI,Tahoma,sans-serif;line-height:1.9;">
<h2 style="color:#8B6914;">بخصوص طلب الانضمام — ${SITE_NAME}</h2>
<p>السلام عليكم ${name || "أخي"}،</p>
<p>بعد مراجعة طلبك، <strong>لم يُقبل انضمامك</strong> إلى المجتمع في الوقت الحالي.</p>
${note ? `<p><strong>ملاحظة الإدارة:</strong> ${note}</p>` : ""}
<hr><p><strong>ماذا تفعل الآن؟</strong></p>
<p>${yt}</p>
<p>بعد الاطلاع على المحتوى يمكنك التقدّم بطلب جديد لاحقاً.</p>
<p style="color:#666;">— فريق ${SITE_NAME}</p>
</div>`;
}

async function sendMail({ to, subject, html, text, logUrl, db: extDb }) {
  const { db, close } = resolveDb(extDb);
  const logDir = path.join(__dirname, "..", "data");
  const entry = { to, subject, at: new Date().toISOString() };

  const plain = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const htmlFixed = html.replace(/<motion /g, "<div ");

  try {
    const { cfg } = getAppConfig(db);
    if (cfgSmtpOk({ cfg })) {
      try {
        const nodemailer = require("nodemailer");
        const port = parseInt(cfg.SMTP_PORT || "587", 10);
        const secure = cfg.SMTP_SECURE === "true" || port === 465;
        const transporter = nodemailer.createTransport({
          host: cfg.SMTP_HOST,
          port,
          secure,
          requireTLS: !secure && port === 587,
          auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
          connectionTimeout: 15000,
          greetingTimeout: 15000,
        });
        await transporter.sendMail({
          from: cfgMailFrom({ cfg }),
          to,
          subject,
          text: plain,
          html: htmlFixed,
        });
        entry.status = "sent";
        entry.ok = true;
      } catch (err) {
        entry.status = "error";
        entry.ok = false;
        entry.error = err.message;
        console.error("[mail]", err.message);
        if (err.response) console.error("[mail] SMTP response:", err.response);
      }
    } else {
      entry.status = "console";
      entry.ok = false;
      entry.error =
        "SMTP غير مُعدّ — عيّن من /admin/system أو SMTP_* في Environment Variables";
      console.log("\n========== بريد (لم يُرسل — فعّل SMTP) ==========");
      console.log("إلى:", to, "| الموضوع:", subject);
      if (logUrl) console.log("الرابط:", logUrl);
      console.log(plain);
      console.log("========================================================\n");
      if (logUrl) entry.logUrl = logUrl;
    }
  } finally {
    if (close) db.close();
  }

  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(path.join(logDir, "email_log.txt"), JSON.stringify(entry) + "\n");
  return entry;
}

async function sendWelcomeEmail(user, db) {
  const name = user.full_name || user.email.split("@")[0];
  const base = loginUrl(db);
  return sendMail({
    db,
    to: user.email,
    subject: `حسابك مفعّل — ${SITE_NAME}`,
    html: welcomeEmailHtml(name, base),
    text: `تم تفعيل حسابك. الدخول: ${base}/auth/login\n\n${youtubeBlock()}`,
  });
}

async function sendApprovedEmail(user, db) {
  return sendWelcomeEmail(user, db);
}

async function sendRejectedEmail(user, note, db) {
  const name = user.full_name || user.email.split("@")[0];
  return sendMail({
    db,
    to: user.email,
    subject: `بخصوص طلب الانضمام — ${SITE_NAME}`,
    html: rejectedEmailHtml(name, note),
    text: `لم يُقبل طلبك حالياً.\n${note || ""}\n\n${youtubeBlock()}`,
  });
}

function newsletterEmailHtml(user, dose, baseUrl) {
  const name = user.full_name || user.email.split("@")[0];
  const link = dose.link_url
    ? `${baseUrl}${dose.link_url.startsWith("/") ? dose.link_url : "/" + dose.link_url}`
    : `${baseUrl}/cadres`;
  const bodyHtml = (dose.content || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<div dir="rtl" style="font-family:Segoe UI,Tahoma,sans-serif;line-height:1.9;">
<h2 style="color:#8B6914;">${dose.subject}</h2>
<p>السلام عليكم ${name}،</p>
<p>${bodyHtml}</p>
<p><a href="${link}" style="color:#8B6914;font-weight:bold;">اقرأ المزيد في المنصة</a></p>
<p style="color:#666;font-size:0.9em;">جرعات الوعي — نشرة دورية من مساعدك ومكتبة الوعي. ليست إعلاناً.</p>
<p style="color:#666;">— فريق ${SITE_NAME}</p>
</div>`;
}

async function sendNewsletterEmail(user, dose, db) {
  const base = loginUrl(db);
  return sendMail({
    db,
    to: user.email,
    subject: dose.subject,
    html: newsletterEmailHtml(user, dose, base),
    text: `${dose.subject}\n\n${dose.content}\n\n${dose.link_url || base}`,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendApprovedEmail,
  sendRejectedEmail,
  sendNewsletterEmail,
  sendMail,
  smtpConfigured,
  mailFromDisplay,
  mailFlashMessage,
  loginUrl,
  SITE_NAME,
  YOUTUBE_URL,
};
