# نسخ المشروع على الجهاز

## المجلدات

| المسار | الاستخدام |
|--------|-----------|
| `d:\Dropbox\wsf` | النسخة الرئيسية (Dropbox + Git) |
| `D:\shifra-wsf` | نسخة محلية على الجهاز (بدون ملفات Dropbox المتعارضة) |
| GitHub | `https://github.com/kafiky121973/wsf` — فرع `master` |

## تحديث النسخة المحلية

```powershell
cd d:\Dropbox\wsf
powershell -ExecutionPolicy Bypass -File scripts\sync-local-copy.ps1
```

## تحديث GitHub

```powershell
cd d:\Dropbox\wsf
git add -A
git status
git commit -m "وصف التغيير"
git push origin master
```

Hostinger يقرأ من GitHub — بعد `push` نفّذ **Redeploy** من لوحة Node.js.

## قاعدة البيانات

| البيئة | الافتراضي |
|--------|-----------|
| محلياً | **SQLite** — `data/shifra.db` (لا تحتاج MySQL على الجهاز) |
| Hostinger | **MySQL** — تضبطه أنت من `/admin/system` أو Environment Variables |

راجع `deploy/MYSQL.md` عند النشر.
