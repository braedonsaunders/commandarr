# Commandarr Helper — One-line installer for Windows
# Usage: irm https://raw.githubusercontent.com/braedonsaunders/commandarr/main/helper/install.ps1 | iex

$ErrorActionPreference = "Stop"

$InstallDir = "$env:USERPROFILE\.commandarr-helper"
$HelperUrl = "https://raw.githubusercontent.com/braedonsaunders/commandarr/main/helper/commandarr-helper.js"

Write-Host "`n  Installing Commandarr Helper...`n" -ForegroundColor Cyan

# Check for Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  Node.js is required. Install it from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Create install directory
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

# Download helper
Invoke-WebRequest -Uri $HelperUrl -OutFile "$InstallDir\commandarr-helper.js"
Write-Host "  Downloaded helper" -ForegroundColor Green

# Generate token
$Token = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

# Create startup batch file
@"
@echo off
set HELPER_PORT=9484
set HELPER_TOKEN=$Token
node "%~dp0commandarr-helper.js"
"@ | Out-File -FilePath "$InstallDir\start.bat" -Encoding ascii

# Create scheduled task to run at startup
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$InstallDir\start.bat`"" -WorkingDirectory $InstallDir
$Trigger = New-ScheduledTaskTrigger -AtLogon
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0
Register-ScheduledTask -TaskName "CommandarrHelper" -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
Write-Host "  Registered startup task" -ForegroundColor Green

# Start it now
Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$InstallDir\start.bat`"" -WindowStyle Hidden
Write-Host "  Helper started`n" -ForegroundColor Green

Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "    Commandarr Helper running on port 9484"
Write-Host ""
Write-Host "    Add these to your Commandarr container:"
Write-Host ""
Write-Host "      HELPER_URL=http://host.docker.internal:9484" -ForegroundColor Yellow
Write-Host "      HELPER_TOKEN=$Token" -ForegroundColor Yellow
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor DarkGray
