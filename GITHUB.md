# رفع المشروع على GitHub

## ما يُرفع وما لا يُرفع

| يُرفع | لا يُرفع (`.gitignore`) |
|--------|-------------------------|
| `server.js`, `package.json`, `lib/`, `templates/`, `static/`, `scripts/`, `deploy/` | `node_modules/` |
| `.env.example` (بدون أسرار) | `.env` و `SMTP_PASS` |
| `README.md`, `DEPLOY.md` | `data/shifra.db`, `data/vapid.json` |
| | `uploads/` |

**مهم:** لا ترفع أبداً `.env` أو قاعدة `shifra.db` أو كلمات مرور SMTP.

---

## 1) تثبيت Git

[https://git-scm.com/download/win](https://git-scm.com/download/win)

---

## 2) أول مرة — من مجلد المشروع

```powershell
cd d:\Dropbox\wsf

git init
git add .
git status
```

تأكد أن `git status` **لا** يعرض: `node_modules`, `.env`, `data/shifra.db`, `uploads`.

```powershell
git commit -m "Initial commit: شفرة الفطرة — Node.js"
```

---

## 3) إنشاء مستودع على GitHub

1. [github.com/new](https://github.com/new)
2. اسم المستودع مثلاً: `shifra-fitra` أو `ark4all`
3. **Private** موصى به (يحتوي منطق التطبيق وإعدادات النشر)
4. **لا** تضف README أو .gitignore من GitHub (موجودان محلياً)

---

## 4) الربط والرفع

```powershell
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

**مهم لـ Hostinger:** الفرع يجب أن يكون **`main`** وفيه `package.json` و `server.js` في **جذر** المستودع.  
إن ظهر «إطار عمل غير مدعوم» راجع **[deploy/HOSTINGER-GITHUB.md](deploy/HOSTINGER-GITHUB.md)**.

استبدل `USERNAME` و `REPO` باسمك ومستودعك.

---

## 5) النشر على Hostinger من GitHub

في hPanel → Node.js App → **Import Git Repository** → اختر المستودع.

عيّن **Environment Variables** (لا تعتمد على `.env` في المستودع):

- `SITE_URL`, `SECRET_KEY`, `SMTP_*`, `MAIL_FROM`, …

انظر `deploy/env-ark4all.example` و `deploy/HOSTINGER.md`.

---

## 6) تحديثات لاحقة

```powershell
git add .
git commit -m "وصف التغيير"
git push
```

Hostinger يمكن أن يعيد النشر تلقائياً بعد كل `push`.

---

## استثناء: ملفات المساعد في data/

افتراضياً مجلد `data/` كامل مستبعد. إن أردت رفع `rag_qa_mapping.csv` فقط، عدّل `.gitignore`:

```gitignore
data/*
!data/rag_qa_mapping.csv
!data/library-templates/
```
