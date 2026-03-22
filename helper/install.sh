#!/bin/bash
# Commandarr Helper — One-line installer for Linux/macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/braedonsaunders/commandarr/main/helper/install.sh | bash

set -e

INSTALL_DIR="$HOME/.commandarr-helper"
HELPER_URL="https://raw.githubusercontent.com/braedonsaunders/commandarr/main/helper/commandarr-helper.js"

echo "🛰️  Installing Commandarr Helper..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install it from https://nodejs.org"
    exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download helper
curl -fsSL "$HELPER_URL" -o "$INSTALL_DIR/commandarr-helper.js"
echo "✅ Downloaded helper to $INSTALL_DIR/commandarr-helper.js"

# Generate a random token
TOKEN=$(openssl rand -hex 16 2>/dev/null || head -c 32 /dev/urandom | xxd -p | head -c 32)

# Create env file
cat > "$INSTALL_DIR/.env" << EOF
HELPER_PORT=9484
HELPER_TOKEN=$TOKEN
EOF

echo "✅ Generated auth token"

# Create systemd service (Linux only)
if [[ "$(uname)" == "Linux" ]] && command -v systemctl &> /dev/null; then
    sudo tee /etc/systemd/system/commandarr-helper.service > /dev/null << UNIT
[Unit]
Description=Commandarr Helper
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$(which node) $INSTALL_DIR/commandarr-helper.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

    sudo systemctl daemon-reload
    sudo systemctl enable commandarr-helper
    sudo systemctl start commandarr-helper
    echo "✅ Installed and started systemd service"
fi

# Create launchd plist (macOS only)
if [[ "$(uname)" == "Darwin" ]]; then
    PLIST="$HOME/Library/LaunchAgents/com.commandarr.helper.plist"
    cat > "$PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.commandarr.helper</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>$INSTALL_DIR/commandarr-helper.js</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HELPER_PORT</key>
        <string>9484</string>
        <key>HELPER_TOKEN</key>
        <string>$TOKEN</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
PLIST

    launchctl load "$PLIST" 2>/dev/null || true
    echo "✅ Installed and started launchd service"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Commandarr Helper is running on port 9484"
echo ""
echo "  Add these to your Commandarr container:"
echo ""
echo "    HELPER_URL=http://host.docker.internal:9484"
echo "    HELPER_TOKEN=$TOKEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
