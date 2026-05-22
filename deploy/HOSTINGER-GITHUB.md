# ربط GitHub مع Hostinger — حل «إطار عمل غير مدعوم»

## السبب الأشهر

1. **المستودع فارغ** — لم يُرفع `package.json` و `server.js` (لا commit / لا push).
2. **الفرع خاطئ** — Hostinger يقرأ **`main`** والمشروع على **`master`**.
3. **مجلد الجذر خاطئ** — إن كان المستودع داخل مجلد فرعي وليس جذر المستودع.
4. **إعدادات البناء خاطئة** — اختيار Next.js بدل Express، أو `Output directory` = `dist` بدل `.`

---

## قبل الربط — تأكد من GitHub

على جهازك:

```powershell
cd d:\Dropbox\wsf
git status
git log -1 --oneline
```

يجب أن ترى commit وفيه `package.json` و `server.js`.

```powershell
git branch -M main
git push -u origin main
```

افتح المستودع على GitHub وتأكد أن فرع **main** يحتوي الملفات (ليس README فقط).

---

## في Hostinger (hPanel)

**Websites** → **Add Website** → **Node.js Apps** → **Import Git Repository**

| الإعداد | القيمة |
|---------|--------|
| **Framework** | **Express.js** (إن لم يظهر: **Other**) |
| **Root directory** | `.` أو فارغ (جذر المستودع) |
| **Node.js version** | **22.x** |
| **Install command** | `npm install` |
| **Build command** | `npm run build` |
| **Start command** | `npm start` |
| **Entry file** | `server.js` |
| **Output directory** | `.` (نقطة — **ليس** `dist` ولا `build`) |

ثم **Environment Variables** (انظر `env-ark4all.example`) → **Deploy**.

---

## إن استمر الخطأ عند الربط

1. احذف محاولة الموقع الفاشلة من hPanel وأعد **Import Git** من جديد.
2. اختر مستودعاً فيه `package.json` في **الجذر** (ليس monorepo).
3. جرّب **رفع ZIP** بدلاً من Git: `scripts\pack-deploy.ps1` → `D:\Dropbox\node uplode\shifra-fitra-node.zip`.
4. تواصل مع دعم Hostinger وأرسل رابط المستودع — اطلب تفعيل **Express.js** على فرع `main`.

---

## بعد النشر

- `https://دومينك.com/health` → `{"ok":true,"smtp":...}`
- **لا** تضف `BIND_HOST=127.0.0.1` على Hostinger
- `data/` و `uploads/` تُنشأ على السيرفر — لا ترفع `shifra.db` من Git
