@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [خطأ] Node.js غير مثبت. حمّله من https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo تثبيت الحزم...
  call npm install
  if errorlevel 1 (
    echo [خطأ] فشل npm install
    pause
    exit /b 1
  )
)

if not exist "templates\base.html" (
  echo [خطأ] مجلد templates غير موجود
  pause
  exit /b 1
)

node scripts\patch-templates.js 2>nul

echo.
echo  تشغيل شفرة الفطرة...
echo  http://127.0.0.1:3000
echo.
node server.js
pause
