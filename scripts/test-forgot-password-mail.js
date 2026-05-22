/**
 * اختبار إرسال بريد «نسيت كلمة المرور» (نفس مسار الموقع)
 * الاستخدام: node scripts/test-forgot-password-mail.js user@example.com
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

const { getDb, initDb } = require("../lib/db");
const { sendPasswordResetEmail } = require("../lib/auth-email");
const { smtpConfigured, mailFlashMessage } = require("../lib/mail");

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("الاستخدام: node scripts/test-forgot-password-mail.js البريد@example.com");
  process.exit(1);
}

console.log("SMTP مُعد:", smtpConfigured() ? "نعم" : "لا");
if (!smtpConfigured()) {
  console.error("أضف SMTP_* في .env أو Environment Variables على Hostinger ثم أعد التشغيل.");
}

initDb();
const db = getDb();
try {
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email);
  if (!user) {
    console.error("لا يوجد مستخدم بهذا البريد في القاعدة.");
    process.exit(1);
  }
  if (user.status === "rejected") {
    console.error("الحساب مرفوض — الموقع لا يرسل له استعادة كلمة المرور.");
    process.exit(1);
  }
  sendPasswordResetEmail(db, user)
    .then((mailResult) => {
      console.log("نتيجة الإرسال:", mailResult);
      const flash = mailFlashMessage(mailResult, {
        successMessage: "أُرسل رابط إعادة التعيين",
        isProduction: process.env.NODE_ENV === "production",
      });
      console.log("رسالة للمستخدم:", flash.type, "—", flash.message);
      process.exit(mailResult?.ok ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} finally {
  db.close();
}
