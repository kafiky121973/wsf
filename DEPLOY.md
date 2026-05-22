# نشر شفرة الفطرة على دومين

> **Hostinger (hPanel → Node.js Web Apps):** راجع الدليل المفصّل [`deploy/HOSTINGER.md`](deploy/HOSTINGER.md) — خطط Business/Cloud، ZIP أو GitHub، متغيرات البيئة في اللوحة، وسبب 403.

## 1. متغيرات البيئة (`.env`)

انسخ `.env.example` إلى `.env` على السيرفر واملأ:

| المتغير | مطلوب | الوصف |
|---------|--------|--------|
| `NODE_ENV` | نعم | `production` |
| `SITE_URL` | نعم | `https://yourdomain.com` |
| `SECRET_KEY` | نعم | 32+ حرف عشوائي (`openssl rand -hex 32`) |
| `COOKIE_SECURE` | نعم | `true` |
| `FORCE_HTTPS` | نعم | `true` |
| `BIND_HOST` | موصى | `127.0.0.1` خلف nginx |
| `PORT` | اختياري | `3000` |
| `SMTP_*` | للبريد | تأكيد البريد + نسيان كلمة المرور |

## 2. تشغيل التطبيق

**متطلب:** Node **22.5+** (يستخدم `node:sqlite` المدمج — بدون `better-sqlite3` ولا بناء native).

```bash
npm ci --omit=dev
# الشعار: ضع logo.webp في static/icons/ (صورتك الدائرية) ثم:
npm run assets
# أو يُولَّد تلقائياً من icon.svg عند أول تشغيل
NODE_ENV=production node server.js
```

**مهم:** ارفع مجلد `static/icons/` كاملاً (أو شغّل `npm run assets` على السيرفر).  
بعد كل تحديث للكود: أعد تشغيل العملية (`pm2 restart shifra`).

أو **PM2**:

```bash
pm2 start server.js --name shifra -i 1
pm2 save
```

## 3. nginx (مثال)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /path/fullchain.pem;
    ssl_certificate_key /path/privkey.pem;

    client_max_body_size 210M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

## 4. أمان ما بعد النشر

- [ ] غيّر كلمة مرور `admin` و`designer` فوراً
- [ ] لا ترفع `.env` ولا `data/shifra.db` إلى git
- [ ] صلاحيات مجلد `data/` و`uploads/` للمستخدم الذي يشغّل Node فقط
- [ ] نسخ احتياطي دوري لـ `data/shifra.db`
- [ ] فعّل SMTP لرسائل التأكيد واستعادة كلمة المرور

## 5. ملفات لا تُعرض للعامة

يُخدم فقط: `/static/` و`/uploads/` (مع حظر امتدادات خطرة).
لا تضع قاعدة البيانات أو `.env` تحت مجلد عام.

## 6. خطأ 403 «Access to this resource on the server is denied!»

هذه الرسالة **من Apache/cPanel** وليست من تطبيق Node — يعني أن الطلب **لم يصل** لتطبيقك.

**الحل:**

1. شغّل التطبيق: `pm2 start server.js --name shifra` أو تطبيق Node في cPanel.
2. تأكد أن المنفذ `3000` (أو `PORT` في `.env`) يعمل: `curl http://127.0.0.1:3000/health`
3. وجّه الدومين للتطبيق — انسخ `deploy/htaccess-proxy.example` إلى `.htaccess` في جذر الموقع وعدّل المنفذ.
4. أو استخدم **Setup Node.js App** في cPanel وحدّد `server.js` كملف تشغيل.
5. لا ترفع المشروع إلى `public_html` فقط بدون تشغيل Node — لن يعمل.

إن ظهرت «طلب غير مسموح» بالعربية فذلك من التطبيق — تأكد أن `SITE_URL` يطابق الدومين بالضبط (مع `https://`).

## 7. فحص سريع

```bash
curl -I https://yourdomain.com/
# يجب: Strict-Transport-Security, X-Content-Type-Options
curl https://yourdomain.com/health
# {"ok":true}
```
