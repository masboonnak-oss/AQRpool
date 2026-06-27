<#
  update.ps1 - One-step deploy for the Aquarich server.
  Does: git pull -> pnpm install -> build -> restart API (+ web if a launcher exists).

  Usage (open PowerShell in the Pooledit-main folder):
      .\update.ps1

  Notes:
  - Finds the project from the script's own location (no path editing needed).
  - If the build fails it does NOT restart, so the currently-running code keeps serving.
  - Restart uses this machine's own .run-logs\start-api.ps1 (which holds its local secrets).
  - ASCII-only on purpose so Windows PowerShell 5.1 always parses it correctly.
#>
$ErrorActionPreference = "Stop"

$proj     = $PSScriptRoot                                   # the Pooledit-main folder
$node     = "C:\Program Files\nodejs\node.exe"
$corepack = "C:\Program Files\nodejs\node_modules\corepack\dist\corepack.js"

function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)       { Write-Host "    OK - $msg" -ForegroundColor Green }
function Warn($msg)     { Write-Host "    ! $msg" -ForegroundColor Yellow }

# pnpm's preinstall hook calls `node`, so make sure node is on PATH
if (Test-Path $node) { $env:Path = (Split-Path $node) + ";" + $env:Path }

# ---- 1) Pull the latest code from GitHub ---------------------------------
Step 1 "Pull latest code (git pull)"
git -C $proj pull --ff-only
if ($LASTEXITCODE -ne 0) {
  Warn "git pull failed - this machine may have local edits that conflict with the remote."
  Warn "On a pull-only server, force it to match the remote with:"
  Warn "    git -C `"$proj`" fetch origin; git -C `"$proj`" reset --hard origin/main"
  exit 1
}
Ok "code updated"

# ---- 2) Install dependencies ---------------------------------------------
Step 2 "Install dependencies (pnpm install)"
Push-Location $proj
try {
  & $node $corepack pnpm install
  if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }
} finally { Pop-Location }
Ok "dependencies installed"

# ---- 3) Build (typecheck + build all packages) ---------------------------
Step 3 "Build (typecheck + build)"
Push-Location $proj
try {
  & $node $corepack pnpm run build
  if ($LASTEXITCODE -ne 0) { throw "build failed - skipping restart (server keeps running the old build)" }
} finally { Pop-Location }
Ok "build passed"

# ---- 4) Restart the API server (:5000) -----------------------------------
Step 4 "Restart API server (:5000)"
$startApi = Join-Path $proj ".run-logs\start-api.ps1"
if (Test-Path $startApi) {
  & $startApi
  Ok "start-api.ps1 invoked"
} else {
  Warn "no .run-logs\start-api.ps1 found - skipping API restart (start it your usual way)"
}

# ---- 5) Restart the web frontend (only if a launcher exists) -------------
Step 5 "Restart web frontend"
$startWeb = Join-Path $proj ".run-logs\start-web.ps1"
if (Test-Path $startWeb) {
  & $startWeb
  Ok "start-web.ps1 invoked"
} else {
  Warn "no .run-logs\start-web.ps1 - frontend was rebuilt at artifacts\pool-reservation\dist\public"
  Warn "if you serve it with vite, restart the web process your usual way"
}

Write-Host "`nDONE - update complete" -ForegroundColor Green
