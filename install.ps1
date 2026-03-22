# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Commandarr Installer / Updater for Windows
#  The only script you need. Installs, updates, and configures everything.
#
#  Usage:
#    irm https://raw.githubusercontent.com/braedonsaunders/commandarr/main/install.ps1 | iex
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

$ErrorActionPreference = "Stop"

$Repo = "braedonsaunders/commandarr"
$Image = "ghcr.io/${Repo}:latest"
$DefaultDir = "$env:USERPROFILE\commandarr"
$HelperPort = 9484

function Banner {
  Write-Host ""
  Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "  ║  " -NoNewline -ForegroundColor Cyan; Write-Host "🛰️  Commandarr" -NoNewline -ForegroundColor White; Write-Host "                           ║" -ForegroundColor Cyan
  Write-Host "  ║  " -NoNewline -ForegroundColor Cyan; Write-Host "The AI brain for your media stack" -NoNewline -ForegroundColor DarkGray; Write-Host "        ║" -ForegroundColor Cyan
  Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""
}

function Info($msg)    { Write-Host "  → " -NoNewline -ForegroundColor Blue; Write-Host $msg }
function Success($msg) { Write-Host "  ✓ " -NoNewline -ForegroundColor Green; Write-Host $msg }
function Warn($msg)    { Write-Host "  ! " -NoNewline -ForegroundColor Yellow; Write-Host $msg }
function Err($msg)     { Write-Host "  ✗ " -NoNewline -ForegroundColor Red; Write-Host $msg }

function Ask($prompt, $default) {
  if ($default) {
    Write-Host "  ? " -NoNewline -ForegroundColor Cyan; Write-Host "${prompt} " -NoNewline; Write-Host "(${default})" -NoNewline -ForegroundColor DarkGray; Write-Host ": " -NoNewline
  } else {
    Write-Host "  ? " -NoNewline -ForegroundColor Cyan; Write-Host "${prompt}: " -NoNewline
  }
  $input = Read-Host
  if ([string]::IsNullOrEmpty($input)) { return $default } else { return $input }
}

function AskYN($prompt, $default = "y") {
  $hint = if ($default -eq "y") { "[Y/n]" } else { "[y/N]" }
  Write-Host "  ? " -NoNewline -ForegroundColor Cyan; Write-Host "${prompt} " -NoNewline; Write-Host $hint -NoNewline -ForegroundColor DarkGray; Write-Host ": " -NoNewline
  $input = Read-Host
  if ([string]::IsNullOrEmpty($input)) { $input = $default }
  return $input -match "^[Yy]"
}

function GenerateKey {
  return -join ((48..57) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
}

# ─── Start ───────────────────────────────────────────────────────────

Banner

# Check Docker
try { docker info 2>$null | Out-Null } catch {
  Err "Docker is not running. Start Docker Desktop and try again."
  exit 1
}
Success "Docker is running"

# ─── Detect existing installation ───────────────────────────────────

$InstallDir = $DefaultDir
$IsUpdate = $false

if ((Test-Path ".\docker-compose.yml") -and (Select-String -Path ".\docker-compose.yml" -Pattern "commandarr" -Quiet -ErrorAction SilentlyContinue)) {
  $InstallDir = (Get-Location).Path
  $IsUpdate = $true
} elseif (Test-Path "$DefaultDir\docker-compose.yml") {
  $InstallDir = $DefaultDir
  $IsUpdate = $true
}

if ($IsUpdate) {
  Write-Host ""
  Info "Existing installation found at $InstallDir"
  Write-Host ""

  if (AskYN "Update to the latest version?" "y") {
    Set-Location $InstallDir
    Info "Pulling latest image..."
    docker pull $Image
    Success "Image updated"

    Info "Restarting..."
    docker compose up -d
    Success "Commandarr updated and running!"

    # Check helper
    $HelperDir = "$env:USERPROFILE\.commandarr-helper"
    if (Test-Path "$HelperDir\commandarr-helper.js") {
      if (AskYN "Update the Commandarr Helper too?" "y") {
        Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$Repo/main/helper/commandarr-helper.js" -OutFile "$HelperDir\commandarr-helper.js"
        Success "Helper updated (restart it manually or reboot)"
      }
    }

    if (-not (AskYN "Reconfigure settings?" "n")) {
      Write-Host ""; Write-Host "  All done! 🛰️" -ForegroundColor Green; Write-Host ""
      exit 0
    }
    $IsUpdate = $false
  } else { exit 0 }
}

# ─── Fresh Install / Reconfigure ────────────────────────────────────

if (-not $IsUpdate) {
  Write-Host ""
  Write-Host "  Let's set up Commandarr." -ForegroundColor White
  Write-Host ""
  $InstallDir = Ask "Install directory" $DefaultDir
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  Set-Location $InstallDir
}

Write-Host ""
Write-Host "  ── Core Settings ──" -ForegroundColor White
Write-Host ""

$Port = Ask "Dashboard port" "8484"
$EncryptionKey = GenerateKey

# Auth
Write-Host ""
Write-Host "  ── Authentication ──" -ForegroundColor White
Write-Host ""

$AuthUser = ""; $AuthPass = ""
if (AskYN "Enable dashboard authentication?" "y") {
  $AuthUser = Ask "Username" "admin"
  $AuthPass = Ask "Password" ""
  while ([string]::IsNullOrEmpty($AuthPass)) {
    Warn "Password cannot be empty"
    $AuthPass = Ask "Password" ""
  }
  Success "Auth enabled: $AuthUser / ****"
} else { Info "No authentication" }

# Telegram
Write-Host ""
Write-Host "  ── Telegram Bot (optional) ──" -ForegroundColor White
Write-Host ""

$TelegramToken = ""
if (AskYN "Set up Telegram bot?" "n") {
  Write-Host "  Get a token from @BotFather on Telegram" -ForegroundColor DarkGray
  $TelegramToken = Ask "Bot token" ""
  Success "Telegram configured"
}

# Plex restart
Write-Host ""
Write-Host "  ── Plex Restart Capability ──" -ForegroundColor White
Write-Host ""
Write-Host "  Commandarr can auto-restart Plex when it crashes." -ForegroundColor DarkGray
Write-Host ""

$HelperUrl = ""; $HelperToken = ""; $PlexRestartCmd = ""; $DockerSock = ""

Write-Host "  How is Plex installed?" -ForegroundColor White
Write-Host "    1) Bare metal on this machine (Windows service)" -ForegroundColor Cyan
Write-Host "    2) Docker container on this machine" -ForegroundColor Cyan
Write-Host "    3) Different machine / skip" -ForegroundColor Cyan
Write-Host ""
$PlexChoice = Ask "Choice" "1"

switch ($PlexChoice) {
  "1" {
    Write-Host ""
    Info "Installing Commandarr Helper..."

    $HelperDir = "$env:USERPROFILE\.commandarr-helper"
    New-Item -ItemType Directory -Path $HelperDir -Force | Out-Null
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$Repo/main/helper/commandarr-helper.js" -OutFile "$HelperDir\commandarr-helper.js"

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
      Warn "Node.js is required for the helper. Install from https://nodejs.org"
      Warn "Then run: node $HelperDir\commandarr-helper.js"
    } else {
      $HelperToken = GenerateKey

      # Create start script
      @"
@echo off
set HELPER_PORT=$HelperPort
set HELPER_TOKEN=$HelperToken
node "%~dp0commandarr-helper.js"
"@ | Out-File -FilePath "$HelperDir\start.bat" -Encoding ascii

      # Register scheduled task
      try {
        $Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$HelperDir\start.bat`"" -WorkingDirectory $HelperDir
        $Trigger = New-ScheduledTaskTrigger -AtLogon
        $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0
        Register-ScheduledTask -TaskName "CommandarrHelper" -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
        Success "Helper registered as startup task"
      } catch {
        Warn "Could not register startup task (run as Admin to fix)"
      }

      # Start it now
      Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$HelperDir\start.bat`"" -WindowStyle Hidden
      $HelperUrl = "http://host.docker.internal:$HelperPort"
      Success "Helper running on port $HelperPort"
    }
  }
  "2" {
    $PlexContainer = Ask "Plex container name" "plex"
    $PlexRestartCmd = "docker restart $PlexContainer"
    $DockerSock = "      - /var/run/docker.sock:/var/run/docker.sock"
    Success "Docker restart configured for container: $PlexContainer"
  }
  "3" { Info "Skipped" }
}

# ─── Generate docker-compose.yml ─────────────────────────────────────

Write-Host ""
Info "Writing docker-compose.yml..."

$compose = @"
version: '3.8'
services:
  commandarr:
    image: $Image
    container_name: commandarr
    restart: unless-stopped
    ports:
      - "${Port}:${Port}"
    volumes:
      - ./data:/app/data
$DockerSock
    environment:
      - PORT=$Port
      - ENCRYPTION_KEY=$EncryptionKey
"@

if ($AuthUser)       { $compose += "`n      - AUTH_USERNAME=$AuthUser" }
if ($AuthPass)       { $compose += "`n      - AUTH_PASSWORD=$AuthPass" }
if ($TelegramToken)  { $compose += "`n      - TELEGRAM_BOT_TOKEN=$TelegramToken" }
if ($HelperUrl)      { $compose += "`n      - HELPER_URL=$HelperUrl" }
if ($HelperToken)    { $compose += "`n      - HELPER_TOKEN=$HelperToken" }
if ($PlexRestartCmd) { $compose += "`n      - PLEX_RESTART_COMMAND=$PlexRestartCmd" }

$compose | Out-File -FilePath "$InstallDir\docker-compose.yml" -Encoding utf8
Success "docker-compose.yml written"

# ─── Pull and start ──────────────────────────────────────────────────

Write-Host ""
Info "Pulling Commandarr image..."
docker pull $Image
Success "Image pulled"

Info "Starting Commandarr..."
Set-Location $InstallDir
docker compose up -d
Success "Commandarr is running!"

# ─── Done ────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  🛰️  Commandarr is ready!" -ForegroundColor White
Write-Host ""
Write-Host "  Dashboard:  " -NoNewline -ForegroundColor White; Write-Host "http://localhost:$Port" -ForegroundColor Yellow
if ($AuthUser) { Write-Host "  Login:      " -NoNewline -ForegroundColor White; Write-Host "$AuthUser / ****" }
Write-Host "  Config:     " -NoNewline -ForegroundColor White; Write-Host "$InstallDir\docker-compose.yml"
Write-Host "  Data:       " -NoNewline -ForegroundColor White; Write-Host "$InstallDir\data\"
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor DarkGray
Write-Host "    1. Open the dashboard and go to Settings → LLM Providers"
Write-Host "    2. Add your API key (OpenRouter, OpenAI, etc.)"
Write-Host "    3. Go to Integrations and connect Plex, Radarr, Sonarr"
Write-Host "    4. Start chatting!"
Write-Host ""
Write-Host "  To update later, just run this script again." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
