const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { smtpConfigured, mailFromDisplay } = require("./mail");
const { getAppConfig } = require("./app-config");
const { isProduction, getSiteOrigin } = require("./security");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "shifra.db");
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const VAPID_PATH = path.join(DATA_DIR, "vapid.json");

function envSet(name) {
  const v = process.env[name];
  return v != null && String(v).trim() !== "";
}

function item(key, label, status, message, hint = null, envVar = null, source = null) {
  return { key, label, status, message, hint, env_var: envVar, source };
}

function srcLabel(source) {
  if (source === "admin") return " (لوحة الإدارة)";
  if (source === "env") return " (Hostinger)";
  return "";
}

function dirWritable(dir) {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function vapidSource() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return "env";
  if (fs.existsSync(VAPID_PATH)) return "file";
  return "none";
}

function buildSystemChecks(db = null) {
  const prod = isProduction();
  const { cfg, sources } = getAppConfig(db);
  const groups = [];

  const core = [];
  core.push(
    item(
      "node_env",
      "وضع التشغيل",
      prod ? "ok" : "info",
      prod ? "production" : process.env.NODE_ENV || "development",
      prod ? null : "محلياً للتطوير فقط"
    )
  );

  if (prod) {
    const site = (cfg.SITE_URL || "").trim();
    const siteSrc = sources.SITE_URL;
    if (!site) {
      core.push(
        item(
          "site_url",
          "SITE_URL",
          "error",
          "غير مضبوط",
          "من /admin/system أو Environment Variables: https://ark4all.com",
          "SITE_URL"
        )
      );
    } else if (!site.startsWith("https://")) {
      core.push(
        item(
          "site_url",
          "SITE_URL",
          "error",
          site + srcLabel(siteSrc),
          "يجب أن يبدأ بـ https:// على الإنتاج",
          "SITE_URL",
          siteSrc
        )
      );
    } else {
      core.push(
        item("site_url", "SITE_URL", "ok", site.replace(/\/$/, "") + srcLabel(siteSrc), null, "SITE_URL", siteSrc)
      );
    }

    const secret = process.env.SECRET_KEY || "";
    if (!secret || secret.length < 32 || /dev/i.test(secret)) {
      core.push(
        item(
          "secret_key",
          "SECRET_KEY",
          "error",
          secret ? "ضعيف أو قصير" : "غير مضبوط",
          "سلسلة عشوائية 32+ حرفاً — ثابتة بين كل إعادة نشر",
          "SECRET_KEY"
        )
      );
    } else {
      core.push(item("secret_key", "SECRET_KEY", "ok", "مضبوط (مخفي)"));
    }

    core.push(
      item(
        "cookie_secure",
        "COOKIE_SECURE",
        process.env.COOKIE_SECURE === "true" ? "ok" : "error",
        process.env.COOKIE_SECURE === "true" ? "true" : (process.env.COOKIE_SECURE || "غير مضبوط"),
        "يجب true مع HTTPS",
        "COOKIE_SECURE"
      )
    );
    core.push(
      item(
        "force_https",
        "FORCE_HTTPS",
        process.env.FORCE_HTTPS === "true" ? "ok" : "warn",
        process.env.FORCE_HTTPS === "true" ? "true" : (process.env.FORCE_HTTPS || "غير مضبوط"),
        "موصى به: true",
        "FORCE_HTTPS"
      )
    );

    if (process.env.BIND_HOST === "127.0.0.1") {
      core.push(
        item(
          "bind_host",
          "BIND_HOST",
          "warn",
          "127.0.0.1",
          "على Hostinger لا تضف BIND_HOST أو اجعله 0.0.0.0",
          "BIND_HOST"
        )
      );
    }
  } else {
    core.push(
      item(
        "site_url",
        "SITE_URL",
        envSet("SITE_URL") ? "ok" : "info",
        process.env.SITE_URL || "غير مضبوط (افتراضي محلي)",
        null,
        "SITE_URL"
      )
    );
  }
  groups.push({ id: "core", title: "النشر والأمان", items: core });

  const mail = [];
  if (smtpConfigured(db)) {
    mail.push(
      item(
        "smtp",
        "SMTP",
        "ok",
        "مفعّل — " + (cfg.SMTP_HOST || "") + srcLabel(sources.SMTP_HOST),
        null,
        null,
        sources.SMTP_HOST
      )
    );
    mail.push(
      item("smtp_user", "SMTP_USER", "ok", (cfg.SMTP_USER || "") + srcLabel(sources.SMTP_USER), null, "SMTP_USER", sources.SMTP_USER)
    );
    mail.push(
      item(
        "mail_from",
        "MAIL_FROM",
        cfg.MAIL_FROM ? "ok" : "warn",
        (cfg.MAIL_FROM ? mailFromDisplay(db) : mailFromDisplay(db)) + srcLabel(sources.MAIL_FROM),
        cfg.MAIL_FROM ? null : 'مثال: "شفرة الفطرة" <noreply@ark4all.com>',
        "MAIL_FROM",
        sources.MAIL_FROM
      )
    );
  } else {
    mail.push(
      item(
        "smtp",
        "SMTP (بريد التأكيد ونسيان كلمة المرور)",
        "error",
        "غير مفعّل",
        "احفظ الإعدادات من النموذج أدناه أو Hostinger Environment Variables",
        "SMTP_HOST, SMTP_USER, SMTP_PASS"
      )
    );
    [
      ["SMTP_HOST", cfg.SMTP_HOST, sources.SMTP_HOST, "smtp.hostinger.com"],
      ["SMTP_PORT", cfg.SMTP_PORT, sources.SMTP_PORT, "587"],
      ["SMTP_SECURE", cfg.SMTP_SECURE, sources.SMTP_SECURE, "false"],
      ["SMTP_USER", cfg.SMTP_USER, sources.SMTP_USER, null],
      ["SMTP_PASS", cfg.SMTP_PASS ? "••••••••" : "", sources.SMTP_PASS, null],
      ["MAIL_FROM", cfg.MAIL_FROM, sources.MAIL_FROM, null],
    ].forEach(([k, val, src, hint]) => {
      const ok = k === "SMTP_PASS" ? !!cfg.SMTP_PASS : !!String(val || "").trim();
      mail.push(
        item(
          k.toLowerCase(),
          k,
          ok ? "ok" : k === "SMTP_PASS" || k === "SMTP_HOST" || k === "SMTP_USER" ? "error" : "warn",
          (ok ? val : "غير مضبوط") + srcLabel(src),
          hint,
          k,
          src
        )
      );
    });
  }
  mail.push(
    item(
      "email_verify_ttl",
      "مدة رابط تأكيد البريد",
      "info",
      String(cfg.EMAIL_VERIFY_TTL_MINUTES || "30") + " دقيقة" + srcLabel(sources.EMAIL_VERIFY_TTL_MINUTES),
      "التفعيل بالضغط على الرابط فقط",
      "EMAIL_VERIFY_TTL_MINUTES",
      sources.EMAIL_VERIFY_TTL_MINUTES
    )
  );
  groups.push({ id: "email", title: "البريد الإلكتروني", items: mail });

  const storage = [];
  storage.push(
    item(
      "data_dir",
      "مجلد data/",
      fs.existsSync(DATA_DIR) && dirWritable(DATA_DIR) ? "ok" : "error",
      fs.existsSync(DATA_DIR) ? (dirWritable(DATA_DIR) ? "قابل للكتابة" : "غير قابل للكتابة") : "غير موجود",
      "يحفظ shifra.db و vapid.json و email_log.txt"
    )
  );
  storage.push(
    item(
      "database",
      "قاعدة البيانات",
      fs.existsSync(DB_PATH) ? "ok" : "error",
      fs.existsSync(DB_PATH) ? "shifra.db موجود" : "shifra.db مفقود",
      "عند سيرفر جديد انسخ النسخة الاحتياطية إلى data/"
    )
  );
  storage.push(
    item(
      "uploads_dir",
      "مجلد uploads/",
      fs.existsSync(UPLOADS_DIR) && dirWritable(UPLOADS_DIR) ? "ok" : "warn",
      fs.existsSync(UPLOADS_DIR) ? (dirWritable(UPLOADS_DIR) ? "قابل للكتابة" : "غير قابل للكتابة") : "سيُنشأ عند الرفع",
      "فيديوهات المكتبة ومعرض الشهادات"
    )
  );
  groups.push({ id: "storage", title: "التخزين على السيرفر", items: storage });

  const features = [];
  const vapid = vapidSource();
  features.push(
    item(
      "vapid",
      "إشعارات Web Push",
      vapid !== "none" ? "ok" : "warn",
      vapid === "env" ? "مفاتيح من البيئة" : vapid === "file" ? "data/vapid.json" : "سيُولَّد عند أول طلب",
      "HTTPS + SITE_URL مطلوبان — احفظ vapid.json مع النسخ الاحتياطي",
      "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT"
    )
  );
  features.push(
    item(
      "newsletter_auto",
      "جرعات الوعي التلقائية",
      process.env.NEWSLETTER_AUTO === "1" ? "ok" : "info",
      process.env.NEWSLETTER_AUTO === "1" ? "مفعّلة" : "معطّلة",
      "NEWSLETTER_AUTO=1 لتفعيل الجدولة",
      "NEWSLETTER_AUTO"
    )
  );
  if (process.env.LLM_ENABLED === "1") {
    features.push(
      item(
        "llm",
        "مساعدك (ذكاء اصطناعي)",
        envSet("OPENAI_API_KEY") ? "ok" : "error",
        envSet("OPENAI_API_KEY") ? "OPENAI_API_KEY مضبوط" : "LLM_ENABLED=1 بدون OPENAI_API_KEY",
        null,
        "OPENAI_API_KEY"
      )
    );
  } else {
    features.push(
      item("llm", "مساعدك (ذكاء اصطناعي)", "info", "معطّل (افتراضي)", "LLM_ENABLED=1 اختياري")
    );
  }
  groups.push({ id: "features", title: "ميزات اختيارية", items: features });

  if (db && prod) {
    const security = [];
    try {
      const admin = db.prepare("SELECT password_hash FROM users WHERE username = 'admin' LIMIT 1").get();
      if (admin && bcrypt.compareSync("admin123", admin.password_hash)) {
        security.push(
          item(
            "default_admin_pw",
            "كلمة مرور المدير الافتراضية",
            "error",
            "لا تزال admin123",
            "غيّرها فوراً من /admin/users أو بإعادة تعيين يدوي"
          )
        );
      } else {
        security.push(item("default_admin_pw", "كلمة مرور المدير", "ok", "تم تغيير الافتراضي"));
      }
    } catch (_) {
      /* ignore */
    }
    if (security.length) groups.push({ id: "security", title: "أمان التطبيق", items: security });
  }

  let ok = 0;
  let warn = 0;
  let error = 0;
  for (const g of groups) {
    for (const it of g.items) {
      if (it.status === "ok" || it.status === "info") ok += 1;
      else if (it.status === "warn") warn += 1;
      else if (it.status === "error") error += 1;
    }
  }

  const emailReady = smtpConfigured(db) && (!prod || (cfg.SITE_URL && cfg.SITE_URL.startsWith("https://")));
  const coreReady =
    !prod ||
    (cfg.SITE_URL &&
      String(cfg.SITE_URL).startsWith("https://") &&
      envSet("SECRET_KEY") &&
      String(process.env.SECRET_KEY).length >= 32 &&
      process.env.COOKIE_SECURE === "true");

  return {
    production: prod,
    health_url: getSiteOrigin() ? `${getSiteOrigin()}/health` : "/health",
    summary: {
      ok,
      warn,
      error,
      ready: error === 0 && emailReady && coreReady,
      email_ready: emailReady,
      core_ready: coreReady,
    },
    hostinger_vars: [
      { name: "NODE_ENV", value: "production" },
      { name: "SITE_URL", value: "https://ark4all.com" },
      { name: "SECRET_KEY", value: "(عشوائي 32+ حرف)" },
      { name: "COOKIE_SECURE", value: "true" },
      { name: "FORCE_HTTPS", value: "true" },
      { name: "SMTP_HOST", value: "smtp.hostinger.com" },
      { name: "SMTP_PORT", value: "587" },
      { name: "SMTP_SECURE", value: "false" },
      { name: "SMTP_USER", value: "noreply@ark4all.com" },
      { name: "SMTP_PASS", value: "(كلمة مرور الصندوق)" },
      { name: "MAIL_FROM", value: '"شفرة الفطرة" <noreply@ark4all.com>' },
    ],
    groups,
  };
}

module.exports = { buildSystemChecks };
