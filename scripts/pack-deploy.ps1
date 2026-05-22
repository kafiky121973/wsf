# Build shifra-fitra-node.zip for Hostinger Node.js Web App
# Usage: powershell -ExecutionPolicy Bypass -File scripts\pack-deploy.ps1
# Optional: -OutDir "D:\aaaa"

param(
  [string]$OutDir = "D:\aaaa"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$Stage = Join-Path $env:TEMP ("shifra-pack-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$ZipName = "shifra-fitra-node.zip"
$ZipPath = Join-Path $OutDir $ZipName

$Dirs = @("lib", "templates", "static", "scripts", "deploy")
$RootFiles = @(
  "server.js", "package.json", "package-lock.json",
  ".env.example", ".npmrc", "README.md", "DEPLOY.md"
)

function Copy-Tree($src, $dst) {
  if (-not (Test-Path $src)) { return }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  robocopy $src $dst /E /NFL /NDL /NJH /NJS /nc /ns /np `
    /XD node_modules .git __pycache__ .venv venv uploads `
    /XF *.db *.db-shm *.db-wal .env .env.local *.log | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $src" }
}

function Write-Utf8($path, $lines) {
  $utf8 = New-Object System.Text.UTF8Encoding $true
  [System.IO.File]::WriteAllLines($path, $lines, $utf8)
}

Write-Host "Packing from: $Root"
if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

foreach ($f in $RootFiles) {
  $p = Join-Path $Root $f
  if (Test-Path $p) { Copy-Item $p $Stage -Force }
}

foreach ($d in $Dirs) {
  Copy-Tree (Join-Path $Root $d) (Join-Path $Stage $d)
}

$dataStage = Join-Path $Stage "data"
New-Item -ItemType Directory -Force -Path $dataStage | Out-Null
$rag = Join-Path $Root "data\rag_qa_mapping.csv"
if (Test-Path $rag) { Copy-Item $rag (Join-Path $dataStage "rag_qa_mapping.csv") -Force }
$libTpl = Join-Path $Root "data\library-templates"
if (Test-Path $libTpl) {
  Copy-Tree $libTpl (Join-Path $dataStage "library-templates")
}

$zipReadme = Join-Path $Root "deploy\ZIP-NODE-README.txt"
if (Test-Path $zipReadme) {
  Copy-Item $zipReadme (Join-Path $Stage "deploy\ZIP-NODE-README.txt") -Force
}

Write-Utf8 (Join-Path $dataStage "README-DEPLOY.txt") @(
  "data/ on server:",
  "  shifra.db     - copy your production DB backup here (not included in ZIP)",
  "  vapid.json    - auto-created on first push, or set VAPID_* env vars",
  "  rag_qa_mapping.csv - included in ZIP for the assistant"
)

Write-Utf8 (Join-Path $Stage "BUILD.txt") @(
  "BUILD=$Stamp",
  "NODE_ENTRY=server.js",
  "NPM_START=npm start",
  "EXCLUDES=node_modules,uploads,*.db,.env"
)

Push-Location $Root
try {
  if (Test-Path "package.json") {
    Write-Host "Generating PWA icons (npm run assets)..."
    npm run assets 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-Warning "npm run assets failed - ZIP may lack PNG icons" }
    $iconSrc = Join-Path $Root "static\icons"
    $iconDst = Join-Path $Stage "static\icons"
    if (Test-Path $iconSrc) {
      New-Item -ItemType Directory -Force -Path $iconDst | Out-Null
      Copy-Item (Join-Path $iconSrc "*") $iconDst -Force -ErrorAction SilentlyContinue
    }
  }
} finally {
  Pop-Location
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $Stage, $ZipPath,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

Remove-Item $Stage -Recurse -Force
$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ('OK: ' + $ZipPath + ' (' + $sizeMb + ' MB)')
