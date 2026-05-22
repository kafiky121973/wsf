# قاعدة بيانات MySQL (Hostinger)

## 1. إنشاء القاعدة في Hostinger

1. لوحة Hostinger → **Databases** → MySQL → إنشاء قاعدة ومستخدم.
2. سجّل: **Host**، **Database name**، **User**، **Password**.

## 2. من لوحة الإدارة (موصى به)

1. `/admin/system` → قسم **قاعدة البيانات (MySQL)**.
2. اختر **MySQL** وأدخل البيانات.
3. **حفظ** ثم **اختبار اتصال MySQL**.
4. **Redeploy** للتطبيق Node.

الإعدادات تُحفظ في `data/database.json` (لا يُرفع إلى Git).

## 3. أو عبر Environment Variables

```
DB_DRIVER=mysql
MYSQL_HOST=srvXXX.hstgr.io
MYSQL_PORT=3306
MYSQL_USER=u123_shifra
MYSQL_PASSWORD=...
MYSQL_DATABASE=u123_shifra
```

## 4. نقل البيانات من SQLite

على السيرفر (بعد نسخ `data/shifra.db`):

```bash
node scripts/migrate-sqlite-to-mysql.js
```

ثم Redeploy مع `DB_DRIVER=mysql`.

## 5. التحقق

`GET /health` يجب أن يعرض:

```json
"db_driver": "mysql",
"mysql": true
```
