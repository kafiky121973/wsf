شفرة الفطرة — حزمة Node للرفع (آخر إعداد)
==========================================

1) Hostinger → Websites → Node.js Web App → Upload ZIP (هذا الملف بعد فك الضغط أو الرفع مباشرة)

2) الإعدادات:
   Entry file:  server.js
   Start:       npm start
   Node:        18.x أو 22.x (على 18 يعمل sql.js تلقائياً)

3) متغيرات البيئة في hPanel (لا تعتمد على رفع .env):

   NODE_ENV=production
   SITE_URL=https://دومينك.com
   SECRET_KEY=سلسلة عشوائية 32+ حرف (ثابتة بين كل إعادة نشر)
   COOKIE_SECURE=true
   FORCE_HTTPS=true

   SMTP_HOST=smtp.hostinger.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=بريدك@دومينك.com
   SMTP_PASS=...
   MAIL_FROM="شفرة الفطرة" <noreply@دومينك.com>

   (اختياري Web Push)
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:noreply@دومينك.com

4) بعد النشر:
   - افتح /health → {"ok":true}
   - دخول المدير: /auth/login → admin@shifra.local (غيّر كلمة المرور فوراً)
   - فعّل الإشعارات من داخل الموقع (HTTPS مطلوب)

5) عند إعادة الرفع (تحديث الكود):
   - لا تحذف data/shifra.db ولا data/vapid.json على السيرفر
   - ZIP لا يتضمن قاعدة البيانات — انسخها يدوياً عند الانتقال لسيرفر جديد فقط

6) ما في هذه الحزمة:
   - تفعيل العضو بعد تأكيد البريد
   - مساعد /cadres للأعضاء المفعّلين فقط
   - إشعارات Push للمقترحات والنشرة
   - لوحة دخول منسقة
   - حفظ تسجيل الدخول (اختياري)

تفاصيل: deploy/HOSTINGER.md و DEPLOY.md
