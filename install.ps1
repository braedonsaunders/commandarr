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
$HelperPort = 9484

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
    if (AskYN "Reconfigure settings?" "n") {
      $IsUpdate = $false  # Fall through to configuration
    } else {
      Write-Host ""
      Success "All done!"
      PauseExit 0
    }
  } else {
    PauseExit 0
  }
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
Write-Host "  -- Core Settings --" -ForegroundColor White
Write-Host ""

$Port = Ask "Dashboard port" "8484"
$EncryptionKey = GenerateKey

# ─── Authentication ──────────────────────────────────────────────────

Write-Host ""
Write-Host "  -- Authentication --" -ForegroundColor White
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
} else {
  Info "No authentication (dashboard is open)"
}

# ─── Telegram ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  -- Telegram Bot (optional) --" -ForegroundColor White
Write-Host ""

$TelegramToken = ""
if (AskYN "Set up Telegram bot?" "n") {
  Write-Host "  Get a token from @BotFather on Telegram" -ForegroundColor DarkGray
  $TelegramToken = Ask "Bot token" ""
  if ($TelegramToken) { Success "Telegram configured" }
}

# ─── Plex Restart ────────────────────────────────────────────────────

Write-Host ""
Write-Host "  -- Plex Restart Capability --" -ForegroundColor White
Write-Host ""
Write-Host "  Commandarr can auto-restart Plex when it crashes." -ForegroundColor DarkGray
Write-Host ""

$HelperUrl = ""; $HelperToken = ""; $PlexRestartCmd = ""; $DockerSock = ""

Write-Host "  How is Plex installed?" -ForegroundColor White
Write-Host "    1) Bare metal on this machine (Windows service)" -ForegroundColor Cyan
Write-Host "    2) Docker container on this machine" -ForegroundColor Cyan
Write-Host "    3) Different machine / skip for now" -ForegroundColor Cyan
Write-Host ""
$PlexChoice = Ask "Choice (1/2/3)" "1"

switch ($PlexChoice) {
  "1" {
    Write-Host ""
    Info "Installing Commandarr Helper for bare-metal Plex restart..."

    $HelperDir = "$env:USERPROFILE\.commandarr-helper"
    New-Item -ItemType Directory -Path $HelperDir -Force | Out-Null

    # Check Node.js
    $hasNode = $false
    try {
      $null = & node --version 2>&1
      if ($LASTEXITCODE -eq 0) { $hasNode = $true }
    } catch {}

    if (-not $hasNode) {
      Warn "Node.js is required for the helper."
      Write-Host "  Install from: https://nodejs.org" -ForegroundColor Yellow
      Write-Host "  After installing, re-run this script." -ForegroundColor Yellow
    } else {
      Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$Repo/main/helper/commandarr-helper.js" -OutFile "$HelperDir\commandarr-helper.js"
      Success "Helper downloaded"

      $HelperToken = GenerateKey

      # Create start script
      $startBat = "@echo off`r`nset HELPER_PORT=$HelperPort`r`nset HELPER_TOKEN=$HelperToken`r`nnode `"%~dp0commandarr-helper.js`""
      [System.IO.File]::WriteAllText("$HelperDir\start.bat", $startBat)

      # Register scheduled task
      try {
        $taskAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$HelperDir\start.bat`"" -WorkingDirectory $HelperDir
        $taskTrigger = New-ScheduledTaskTrigger -AtLogon
        $taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
        Register-ScheduledTask -TaskName "CommandarrHelper" -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Force | Out-Null
        Success "Helper registered as startup task"
      } catch {
        Warn "Could not register startup task. Run PowerShell as Admin to fix, or start manually:"
        Write-Host "    $HelperDir\start.bat" -ForegroundColor Yellow
      }

      # Start it now
      try {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$HelperDir\start.bat`"" -WindowStyle Hidden
        Success "Helper started on port $HelperPort"
      } catch {
        Warn "Could not start helper. Run manually: $HelperDir\start.bat"
      }

      $HelperUrl = "http://host.docker.internal:$HelperPort"
    }
  }
  "2" {
    $PlexContainer = Ask "Plex container name" "plex"
    $PlexRestartCmd = "docker restart $PlexContainer"
    $DockerSock = "      - /var/run/docker.sock:/var/run/docker.sock"
    Success "Docker restart configured for container: $PlexContainer"
  }
  "3" {
    Info "Skipped -- you can configure this later in Settings"
  }
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
if ($AuthUser)       { $lines += "      - AUTH_USERNAME=$AuthUser" }
if ($AuthPass)       { $lines += "      - AUTH_PASSWORD=$AuthPass" }
if ($TelegramToken)  { $lines += "      - TELEGRAM_BOT_TOKEN=$TelegramToken" }
if ($HelperUrl)      { $lines += "      - HELPER_URL=$HelperUrl" }
if ($HelperToken)    { $lines += "      - HELPER_TOKEN=$HelperToken" }
if ($PlexRestartCmd) { $lines += "      - PLEX_RESTART_COMMAND=$PlexRestartCmd" }

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

# Always remove any existing commandarr container to avoid conflicts
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
if ($AuthUser) { Write-Host "  Login:      $AuthUser / ****" }
Write-Host "  Config:     $InstallDir\docker-compose.yml" -ForegroundColor DarkGray
Write-Host "  Data:       $InstallDir\data\" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor DarkGray
Write-Host "    1. Open the dashboard -> Settings -> LLM Providers"
Write-Host "    2. Add your API key (OpenRouter, OpenAI, etc.)"
Write-Host "    3. Go to Integrations and connect Plex, Radarr, Sonarr"
Write-Host "    4. Start chatting!"
Write-Host ""
Write-Host "  To update later, run this script again." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  =============================================" -ForegroundColor Green
Write-Host ""

PauseExit 0
