# شفرة الفطرة — The Blueprint

الحصن الرقمي: منصة عربية مستقلة بقاعدة SQLite.

## التشغيل (Node.js — موصى به)

**المتطلب:** [Node.js](https://nodejs.org) **22.5+** (قاعدة البيانات عبر `node:sqlite` المدمج — بدون `better-sqlite3`).

### الطريقة السريعة (Windows)

انقر مرتين على **`start.bat`**  
أو من الطرفية:

```powershell
cd d:\Dropbox\wsf
npm install
npm start
```

افتح: **http://127.0.0.1:3000**

> المنفذ 3000 (وليس 5000) لأن Windows قد يحجب المنفذ 5000.

### حسابات تجريبية

| المستخدم | كلمة المرور | الدور |
|----------|-------------|--------|
| `admin` | `admin123` | مدير |
| `designer` | `designer123` | مصمم |

## التشغيل البديل (Python — اختياري، قديم)

```powershell
pip install -r legacy-python/requirements.txt
python legacy-python/run.py
```

## الأركان

1. **مكتبة الوعي** — `/library`
2. **مجتمع الخلفاء** — `/community`
3. **مساعدك** — `/cadres`
4. **سوق الطيبات** — `/market`

## لوحات التحكم

- `/admin` — إدارة وتفعيل الأعضاء
- `/designer` — تخصيص الألوان والهوية
- `/join` — بروتوكول الانضمام

## قاعدة البيانات

`data/shifra.db` — تُنشأ تلقائياً عند أول تشغيل.

## GitHub

لتجهيز المستودع والرفع: **[GITHUB.md](GITHUB.md)**

## النشر والأمان

قبل رفع الموقع على دومين حقيقي، راجع **[DEPLOY.md](DEPLOY.md)**:

- HTTPS و`SITE_URL` و`SECRET_KEY`
- كوكيز آمنة (`COOKIE_SECURE=true`)
- حدّ لمعدل محاولات الدخول والتسجيل
- رؤوس أمان (CSP, HSTS, …)
- nginx كوكيل عكسي
