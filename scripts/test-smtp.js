/**
 * اختبار إرسال بريد SMTP
 * الاستخدام: node scripts/test-smtp.js you@example.com
 */
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, "..", ".env");
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
const { sendMail, smtpConfigured } = require("../lib/mail");

const to = process.argv[2];
if (!to) {
  console.error("الاستخدام: node scripts/test-smtp.js البريد@example.com");
  process.exit(1);
}

if (!smtpConfigured()) {
  console.error("SMTP غير مُعد. املأ في .env:");
  console.error("  SMTP_HOST=smtp.hostinger.com");
  console.error("  SMTP_PORT=587");
  console.error("  SMTP_SECURE=false");
  console.error("  SMTP_USER=بريدك@دومينك.com");
  console.error("  SMTP_PASS=كلمة_مرور_البريد");
  console.error('  MAIL_FROM="شفرة الفطرة" <noreply@دومينك.com>');
  console.error("  SITE_URL=https://دومينك.com");
  process.exit(1);
}

sendMail({
  to,
  subject: "اختبار SMTP — شفرة الفطرة",
  html: "<p dir='rtl'>إذا وصلتك هذه الرسالة، إعداد البريد صحيح.</p>",
  text: "اختبار SMTP — شفرة الفطرة",
})
  .then((r) => {
    console.log(r);
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
