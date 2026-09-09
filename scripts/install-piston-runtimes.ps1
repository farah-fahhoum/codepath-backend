# Install Piston language runtimes for CodePath (python, c++, node/javascript, java).
# Prerequisites: Docker running, Piston container up (`docker compose up -d piston`).
#
# Usage (from codepath-backend):
#   powershell -ExecutionPolicy Bypass -File scripts/install-piston-runtimes.ps1
#
# Note: `gcc` (C/C++) can take a long time and may need a retry if residual files appear.
# python / node / java are usually enough to unblock Run + Judge development.

$ErrorActionPreference = "Stop"
$PistonUrl = if ($env:PISTON_BASE_URL) { $env:PISTON_BASE_URL.TrimEnd("/") } else { "http://127.0.0.1:2000" }
$WorkRoot = Join-Path $env:TEMP "codepath-piston-cli"
$RepoDir = Join-Path $WorkRoot "piston"

Write-Host "Checking Piston at $PistonUrl ..."
try {
  Invoke-RestMethod -Uri "$PistonUrl/api/v2/runtimes" -Method GET -TimeoutSec 10 | Out-Null
  Write-Host "Piston API is reachable."
} catch {
  Write-Error "Cannot reach Piston at $PistonUrl. Start it with: docker compose up -d piston"
}

if (-not (Test-Path $RepoDir)) {
  Write-Host "Cloning engineer-man/piston CLI (one-time)..."
  New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null
  git clone --depth 1 https://github.com/engineer-man/piston.git $RepoDir
}

Push-Location (Join-Path $RepoDir "cli")
try {
  if (-not (Test-Path "node_modules")) {
    Write-Host "Installing CLI dependencies..."
    npm install --silent
  }

  $packages = @("python", "node", "java", "gcc")
  foreach ($pkg in $packages) {
    Write-Host "Installing runtime package: $pkg (this can take several minutes)..."
    node index.js -u $PistonUrl ppman install $pkg
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Install of $pkg returned exit code $LASTEXITCODE — continuing"
    } else {
      Write-Host "✓ $pkg installed"
    }
  }

  Write-Host ""
  Write-Host "Installed runtimes:"
  Invoke-RestMethod -Uri "$PistonUrl/api/v2/runtimes" -Method GET | ConvertTo-Json -Depth 4
  Write-Host ""
  Write-Host "Done. Set PISTON_BASE_URL=$PistonUrl in .env (already default)."
} finally {
  Pop-Location
}
