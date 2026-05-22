# نشر «شفرة الفطرة» على Hostinger

دليل مخصّص لخطط **Business** و**Cloud** التي تدعم **Node.js Web Apps** في hPanel.  
(الاستضافة المشتركة العادية بدون Node لن تشغّل هذا المشروع — سترى **403 Forbidden** من Apache.)

---

## 1. المتطلبات

| البند | القيمة |
|--------|--------|
| الخطة | Business أو Cloud (Startup وما فوق) |
| Node | **18.x** أو **22.x** — على 18 يُستخدم **sql.js** (JavaScript فقط، بدون بناء native) |
| الإطار | **Express.js** أو **Other** |
| ملف التشغيل | `server.js` |
| أمر التشغيل | `npm start` (موجود في `package.json`) |

---

## 2. رفع المشروع (ZIP)

على جهازك، من مجلد المشروع:

1. **لا تضمّن** `node_modules` ولا `.git`.
2. **ضمّن** كل شيء آخر: `server.js`, `package.json`, `lib/`, `templates/`, `static/`, `scripts/`, `deploy/`, واختيارياً `data/` إن كنت تنقل قاعدة موجودة.
3. اضغط المجلد إلى ملف `.zip`.

في hPanel:

1. **Websites** → **Add Website** → **Node.js Apps**
2. **Upload your website files** → ارفع الـ ZIP
3. إعدادات البناء (إن ظهرت «Other»):
   - **Entry file:** `server.js`
   - **Output directory:** اتركه فارغاً أو `.` (لا يوجد build للواجهة — التطبيق يعمل مباشرة)
   - **Install / Build:** `npm install` ثم (اختياري) `npm run assets` للأيقونات
4. **Deploy**

> Hostinger يضع التطبيق تحت `domains/دومينك/nodejs` ويُنشئ `.htaccess` في `public_html` تلقائياً لتوجيه الطلبات إلى Node. **لا تحتاج** نسخ `deploy/htaccess-proxy.example` يدوياً في هذه الطريقة.

---

## 3. متغيرات البيئة (hPanel → Environment Variables)

لا تعتمد على رفع ملف `.env` إلى Git. عيّن القيم في لوحة Node.js:

```env
NODE_ENV=production
SITE_URL=https://دومينك.com
SECRET_KEY=ضع_هنا_32_حرفاً_عشوائياً_أو_أكثر
COOKIE_SECURE=true
FORCE_HTTPS=true
```

| متغير | على Hostinger |
|--------|----------------|
| `BIND_HOST` | **لا تضفه** أو اجعله `0.0.0.0` — لا تستخدم `127.0.0.1` إلا إذا طلبت الدعم ذلك |
| `PORT` | عادة **يُعيَّن تلقائياً** من Hostinger — لا تغيّره إلا إذا أخبرتك اللوحة بقيمة محددة |
| `VERIFY_ORIGIN` | اتركه غير مفعّل في البداية؛ فعّله لاحقاً بعد ضبط `SITE_URL` بدقة |

بريد (تأكيد التسجيل + استعادة كلمة المرور + النشرة):

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=بريدك@دومينك.com
SMTP_PASS=كلمة_مرور_البريد
MAIL_FROM="شفرة الفطرة" <noreply@دومينك.com>
```

اختياري: `NEWSLETTER_AUTO=1`, `YOUTUBE_CHANNEL_URL=...`, مفاتيح `VAPID_*` للـ Web Push.

بعد حفظ المتغيرات: **Redeploy** أو **Restart** من لوحة Node.js.

### إشعارات المقترحات (Web Push)

تعمل فقط على **HTTPS** (`SITE_URL` بـ `https://`). بعد تسجيل الدخول يظهر شريط «فعّل الإشعارات» أو زر في **مقترحاتكم** / **مراسلة الأعضاء**.

| من يفعّل | ماذا يصل |
|----------|-----------|
| العضو | رد المالك على مقترحاتكم |
| المدير/المشرف | رسالة عضو جديدة في صندوق المراسلة |
| أي مشترك | جرعات الوعي (النشرة) |

**مفاتيح VAPID:** إما يُنشئها السيرفر تلقائياً في `data/vapid.json` (احفظ الملف مع النسخ الاحتياطي)، أو عيّن في البيئة:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:noreply@دومينك.com
```

على iPhone: ثبّت التطبيق من Safari («إضافة إلى الشاشة الرئيسية») ثم فعّل الإشعارات من داخل التطبيق المثبّت.

---

## 4. دومين موجود مسبقاً

Hostinger يطلب غالباً إضافة الموقع كـ **Node.js Web App جديد**:

1. احفظ نسخة من الملفات و`data/shifra.db` إن وُجدت.
2. احذف الموقع القديم من hPanel إن كان موقعاً ثابتاً فقط على `public_html` (بدون Node).
3. **Add Website** → Node.js → ارفع المشروع أو اربط GitHub.
4. اربط نفس الدومين عند اكتمال النشر.

---

## 5. GitHub (بديل ZIP)

1. ارفع المشروع إلى مستودع خاص/عام.
2. hPanel → Node.js Apps → **Import Git Repository**
3. Framework: **Express.js**
4. أضف نفس متغيرات البيئة في **Environment Variables**
5. كل دفع (push) يمكن أن يُعيد النشر تلقائياً

تأكد أن المستودع **لا يحتوي** على `node_modules` أو `.env` أو `data/shifra.db` (أضفها إلى `.gitignore`).

### تغيير إصدار Node (مهم)

إذا ظهر في سجل البناء `current: { node: 'v18.x' }`:

1. **hPanel** → **Websites** → موقع Node.js
2. **Settings** / **Configuration** / **إعدادات التطبيق**
3. **Node.js version** → **22.x** (أو 24.x) — **ليس 18**
4. **Save** ثم **Redeploy** أو **Restart**

---

## 6. بعد النشر

1. افتح: `https://دومينك.com/health` → يجب `{"ok":true,...}`
2. الصفحة الرئيسية والشعار: إن نُقصت الأيقونات شغّل من SSH (إن متاح): `npm run assets` ثم Restart.
3. غيّر فوراً كلمات `admin` و`designer` من لوحة الإدارة.
4. مجلدات قابلة للكتابة على السيرفر: `data/`, `uploads/` (قاعدة SQLite والملفات المرفوعة).

### نسخ احتياطي

- الملف: `data/shifra.db`
- عند إعادة النشر من ZIP **بدون** مجلد `data/` ستبدأ قاعدة جديدة — احفظ النسخة قبل إعادة النشر.

---

## 7. استكشاف الأخطاء

| العرض | السبب | الحل |
|--------|--------|------|
| **403 Forbidden** (إنجليزي، صفحة cPanel/Apache) | Node غير شغّال أو الموقع ليس Node App | أنشئ **Node.js Web App** وليس موقع HTML فقط؛ Restart من اللوحة |
| **EBADENGINE / Node 18** | إصدار Node قديم | غيّر إلى **Node 22.x** في إعدادات Node.js ثم Redeploy |
| **502 / Bad Gateway** | التطبيق تعطل أو Node &lt; 22.5 | سجلات التطبيق؛ شغّل `npm run check-node` على SSH |
| **Cannot find module sharp** | postinstall قديم | حدّث الملفات؛ `sharp` اختياري — التثبيت لا يجب أن يتوقف |
| الصفحة فارغة / بدون CSS | مسار `static/` | تأكد من رفع `static/` كاملاً؛ `npm run assets` |
| «طلب غير مسموح» (عربي) | من التطبيق | طابق `SITE_URL` مع الدومين (`https://` و www إن لزم) |
| البريد لا يُرسل | SMTP | استخدم بريد Hostinger على نفس الدومين؛ جرّب المنفذ 465 و`SMTP_SECURE=true` |
| لا تصل إشعارات Push | HTTP أو لم يُفعَّل | `SITE_URL` بـ https؛ سجّل دخول واضغط «تفعيل»؛ على iOS ثبّت PWA من Safari |

### إعادة تشغيل بدون إعادة بناء

لوحة Node.js → حالة **Running** → **Restart**.

---

## 8. SSH / VPS (اختياري)

إن كان لديك **VPS** وليس Node Web App المُدار:

اتبع `DEPLOY.md` (nginx + pm2). استخدم `deploy/htaccess-proxy.example` فقط على استضافة Apache مشتركة بدون لوحة Node.

---

## 9. قائمة تحقق سريعة

- [ ] خطة Business أو Cloud
- [ ] Node.js App مع `server.js` و `npm start`
- [ ] `SITE_URL` + `SECRET_KEY` + `COOKIE_SECURE` + `FORCE_HTTPS`
- [ ] `static/icons/` مرفوع أو `postinstall` نجح
- [ ] `/health` يعمل
- [ ] SMTP للبريد
- [ ] تغيير كلمات مرور الإدارة
- [ ] نسخة احتياطية لـ `data/shifra.db`

للتفاصيل العامة: `DEPLOY.md` و `.env.example`.
