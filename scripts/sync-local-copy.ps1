# نسخة محلية على الجهاز (خارج تعارضات Dropbox) — للتطوير والنسخ الاحتياطي
# الاستخدام: powershell -ExecutionPolicy Bypass -File scripts\sync-local-copy.ps1
# اختياري: -Target "D:\shifra-wsf"

param(
  [string]$Target = "D:\shifra-wsf"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path $Root)) { throw "المجلد غير موجود: $Root" }

Write-Host "نسخ من: $Root"
Write-Host "إلى:   $Target"

New-Item -ItemType Directory -Force -Path $Target | Out-Null

robocopy $Root $Target /MIR /NFL /NDL /NJH /NJS /nc /ns /np `
  /XD node_modules .git __pycache__ .venv venv uploads "data\backup-*" `
  /XF *.db *.db-wal *.db-shm .env .env.local *.log | Out-Null

if ($LASTEXITCODE -ge 8) { throw "فشل النسخ (robocopy $LASTEXITCODE)" }

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Set-Content -Path (Join-Path $Target "LOCAL-SYNC.txt") -Value "آخر مزامنة: $stamp`nالمصدر: $Root" -Encoding UTF8

Write-Host "OK — النسخة المحلية جاهزة: $Target"
