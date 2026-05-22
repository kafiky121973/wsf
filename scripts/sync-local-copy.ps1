# Local device copy (outside Dropbox conflict files)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\sync-local-copy.ps1
# Optional: -Target "D:\shifra-wsf"

param(
  [string]$Target = "D:\shifra-wsf"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path $Root)) { throw "Source folder not found: $Root" }

Write-Host "From: $Root"
Write-Host "To:   $Target"

New-Item -ItemType Directory -Force -Path $Target | Out-Null

robocopy $Root $Target /MIR /NFL /NDL /NJH /NJS /nc /ns /np `
  /XD node_modules .git __pycache__ .venv venv uploads "data\backup-*" `
  /XF *.db *.db-wal *.db-shm .env .env.local *.log | Out-Null

# robocopy: 0-7 = success (copied / extras); 8+ = error
if ($LASTEXITCODE -ge 8) {
  throw "robocopy failed with exit code $LASTEXITCODE (see robocopy docs)"
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
Set-Content -Path (Join-Path $Target "LOCAL-SYNC.txt") -Value "Last sync: $stamp`nSource: $Root" -Encoding UTF8

Write-Host "Done. Local copy: $Target"
