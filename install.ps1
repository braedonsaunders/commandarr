# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Commandarr Installer / Updater for Windows
#  The only script you need. Installs, updates, and configures everything.
#
#  Usage (PowerShell):
#    irm https://raw.githubusercontent.com/braedonsaunders/commandarr/main/install.ps1 | iex
#
#  Or download and run:
#    Invoke-WebRequest -Uri https://raw.githubusercontent.com/braedonsaunders/commandarr/main/install.ps1 -OutFile install.ps1
#    .\install.ps1
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Don't use Stop — it kills the script on any non-terminating error before the user sees anything
$ErrorActionPreference = "Continue"

$Repo = "braedonsaunders/commandarr"
$Image = "ghcr.io/${Repo}:latest"
$DefaultDir = "$env:USERPROFILE\commandarr"

# ─── Helpers ─────────────────────────────────────────────────────────

function Banner {
  Write-Host ""
  Write-Host "  =============================================" -ForegroundColor Cyan
  Write-Host "     Commandarr" -ForegroundColor White
  Write-Host "     The AI brain for your media stack" -ForegroundColor DarkGray
  Write-Host "  =============================================" -ForegroundColor Cyan
  Write-Host ""
}

function Info($msg)    { Write-Host "  -> $msg" -ForegroundColor Blue }
function Success($msg) { Write-Host "  OK $msg" -ForegroundColor Green }
function Warn($msg)    { Write-Host "  !! $msg" -ForegroundColor Yellow }
function Err($msg)     { Write-Host "  XX $msg" -ForegroundColor Red }

function Ask($prompt, $default) {
  if ($default) {
    Write-Host "  ? ${prompt} (${default}): " -NoNewline -ForegroundColor Cyan
  } else {
    Write-Host "  ? ${prompt}: " -NoNewline -ForegroundColor Cyan
  }
  $val = Read-Host
  if ([string]::IsNullOrEmpty($val)) { return $default } else { return $val }
}

function AskYN($prompt, $default) {
  if (-not $default) { $default = "y" }
  if ($default -eq "y") { $hint = "[Y/n]" } else { $hint = "[y/N]" }
  Write-Host "  ? ${prompt} ${hint}: " -NoNewline -ForegroundColor Cyan
  $val = Read-Host
  if ([string]::IsNullOrEmpty($val)) { $val = $default }
  return $val -match "^[Yy]"
}

function GenerateKey {
  $chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  $key = ""
  for ($i = 0; $i -lt 32; $i++) {
    $key += $chars[(Get-Random -Maximum $chars.Length)]
  }
  return $key
}

function PauseExit($code) {
  Write-Host ""
  Write-Host "  Press Enter to exit..." -ForegroundColor DarkGray
  Read-Host | Out-Null
  exit $code
}

# ─── Start ───────────────────────────────────────────────────────────

Banner

# Check Docker
$dockerOk = $false
try {
  $null = & docker info 2>&1
  if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch {}

if (-not $dockerOk) {
  Err "Docker is not installed or not running."
  Write-Host ""
  Write-Host "  Install Docker Desktop from: https://docker.com/products/docker-desktop" -ForegroundColor Yellow
  Write-Host "  Make sure Docker Desktop is running before trying again."
  PauseExit 1
}
Success "Docker is running"

# Check docker compose
$composeOk = $false
try {
  $null = & docker compose version 2>&1
  if ($LASTEXITCODE -eq 0) { $composeOk = $true }
} catch {}

if (-not $composeOk) {
  Err "Docker Compose is not available. Update Docker Desktop."
  PauseExit 1
}

# ─── Detect existing installation ───────────────────────────────────

$InstallDir = $DefaultDir
$IsUpdate = $false

$currentDirCompose = Join-Path (Get-Location).Path "docker-compose.yml"
$defaultDirCompose = Join-Path $DefaultDir "docker-compose.yml"

if ((Test-Path $currentDirCompose) -and (Select-String -Path $currentDirCompose -Pattern "commandarr" -Quiet -ErrorAction SilentlyContinue)) {
  $InstallDir = (Get-Location).Path
  $IsUpdate = $true
} elseif (Test-Path $defaultDirCompose) {
  if (Select-String -Path $defaultDirCompose -Pattern "commandarr" -Quiet -ErrorAction SilentlyContinue) {
    $InstallDir = $DefaultDir
    $IsUpdate = $true
  }
}

if ($IsUpdate) {
  Write-Host ""
  Info "Existing installation found at $InstallDir"
  Write-Host ""

  if (AskYN "Update to the latest version?" "y") {
    Set-Location $InstallDir
    Info "Pulling latest image..."
    & docker pull $Image
    Success "Image updated"

    # Clean obsolete version key from existing docker-compose.yml
    $composeFile = Join-Path $InstallDir "docker-compose.yml"
    if (Test-Path $composeFile) {
      $content = Get-Content $composeFile -Raw
      $content = $content -replace "(?m)^version:.*\r?\n", ""
      [System.IO.File]::WriteAllText($composeFile, $content)
    }

    # Rescue data from old container if not already on a volume mount
    $dataDir = Join-Path $InstallDir "data"
    if (-not (Test-Path (Join-Path $dataDir "commandarr.db"))) {
      Info "Checking for data inside old container..."
      New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
      & docker cp commandarr:/app/data/commandarr.db "$dataDir/commandarr.db" 2>$null
      if ($LASTEXITCODE -eq 0) {
        Success "Rescued database from old container"
      }
    }

    Info "Restarting..."
    & docker rm -f commandarr 2>$null | Out-Null
    & docker compose up -d
    Success "Commandarr updated and running!"

    # Check helper
    $HelperDir = "$env:USERPROFILE\.commandarr-helper"
    if (Test-Path "$HelperDir\commandarr-helper.js") {
      if (AskYN "Update the Commandarr Helper too?" "y") {
        Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$Repo/main/helper/commandarr-helper.js" -OutFile "$HelperDir\commandarr-helper.js"
        Success "Helper updated (restart your PC or re-run the scheduled task to apply)"
      }
    }

    Write-Host ""
    Success "All done!"
    PauseExit 0
  } else {
    PauseExit 0
  }
}

# ─── Fresh Install ───────────────────────────────────────────────────

Write-Host ""
Write-Host "  Let's set up Commandarr." -ForegroundColor White
Write-Host ""
$InstallDir = Ask "Install directory" $DefaultDir
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Set-Location $InstallDir

Write-Host ""
Write-Host "  -- Core Settings --" -ForegroundColor White
Write-Host ""

$Port = Ask "Dashboard port" "8484"
$EncryptionKey = GenerateKey

# ─── Docker socket (for Plex-in-Docker restart) ──────────────────────

$DockerSock = ""
Write-Host ""
if (AskYN "Does Plex run as a Docker container on this machine?" "n") {
  $DockerSock = "      - /var/run/docker.sock:/var/run/docker.sock"
  Success "Docker socket will be mounted"
}

# ─── Generate docker-compose.yml ─────────────────────────────────────

Write-Host ""
Info "Writing docker-compose.yml..."

$lines = @()
$lines += "services:"
$lines += "  commandarr:"
$lines += "    image: $Image"
$lines += "    container_name: commandarr"
$lines += "    restart: unless-stopped"
$lines += "    ports:"
$lines += "      - `"${Port}:${Port}`""
$lines += "    volumes:"
$lines += "      - ./data:/app/data"
if ($DockerSock) { $lines += $DockerSock }
$lines += "    environment:"
$lines += "      - PORT=$Port"
$lines += "      - ENCRYPTION_KEY=$EncryptionKey"

$composeContent = $lines -join "`n"
[System.IO.File]::WriteAllText("$InstallDir\docker-compose.yml", $composeContent)
Success "docker-compose.yml written"

# ─── Pull and start ──────────────────────────────────────────────────

Write-Host ""
Info "Pulling Commandarr image (this may take a minute)..."
& docker pull $Image
if ($LASTEXITCODE -ne 0) {
  Err "Failed to pull image. Check your internet connection."
  PauseExit 1
}
Success "Image pulled"

Info "Starting Commandarr..."
Set-Location $InstallDir

# Rescue data from old container before removing
$dataDir = Join-Path $InstallDir "data"
if (-not (Test-Path (Join-Path $dataDir "commandarr.db"))) {
  & docker cp commandarr:/app/data/commandarr.db "$dataDir/commandarr.db" 2>$null
  if ($LASTEXITCODE -eq 0) { Success "Rescued database from old container" }
}

# Remove any existing commandarr container to avoid conflicts
Info "Removing old container (if any)..."
& docker rm -f commandarr 2>$null | Out-Null

& docker compose up -d
if ($LASTEXITCODE -ne 0) {
  Err "Failed to start. Check Docker Desktop is running."
  PauseExit 1
}
Success "Commandarr is running!"

# ─── Done ────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  =============================================" -ForegroundColor Green
Write-Host ""
Write-Host "     Commandarr is ready!" -ForegroundColor White
Write-Host ""
Write-Host "  Dashboard:  http://localhost:$Port" -ForegroundColor Yellow
Write-Host "  Config:     $InstallDir\docker-compose.yml" -ForegroundColor DarkGray
Write-Host "  Data:       $InstallDir\data\" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor DarkGray
Write-Host "    1. Open the dashboard -> Settings"
Write-Host "    2. Configure authentication, Telegram, Discord, etc."
Write-Host "    3. Add your LLM API key (Settings -> LLM Providers)"
Write-Host "    4. Go to Integrations and connect Plex, Radarr, Sonarr"
Write-Host "    5. Start chatting!"
Write-Host ""
Write-Host "  All settings are configured in the dashboard -- no env vars needed." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  To update later, run this script again." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  =============================================" -ForegroundColor Green
Write-Host ""

PauseExit 0
