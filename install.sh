#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Commandarr Installer / Updater
#  The only script you need. Installs, updates, and configures everything.
#
#  Usage:
#    curl -fsSL https://raw.githubusercontent.com/braedonsaunders/commandarr/main/install.sh | bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

REPO="braedonsaunders/commandarr"
IMAGE="ghcr.io/$REPO:latest"
DEFAULT_DIR="$HOME/commandarr"
HELPER_PORT=9484

# ─── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}  ╔═══════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}  ║${NC}  🛰️  ${BOLD}Commandarr${NC}                           ${CYAN}║${NC}"
  echo -e "${CYAN}  ║${NC}  ${DIM}The AI brain for your media stack${NC}        ${CYAN}║${NC}"
  echo -e "${CYAN}  ╚═══════════════════════════════════════════╝${NC}"
  echo ""
}

info()    { echo -e "  ${BLUE}→${NC} $1"; }
success() { echo -e "  ${GREEN}✓${NC} $1"; }
warn()    { echo -e "  ${YELLOW}!${NC} $1"; }
error()   { echo -e "  ${RED}✗${NC} $1"; }

ask() {
  local prompt="$1" default="$2" var="$3"
  if [ -n "$default" ]; then
    echo -en "  ${CYAN}?${NC} ${prompt} ${DIM}(${default})${NC}: "
  else
    echo -en "  ${CYAN}?${NC} ${prompt}: "
  fi
  read -r input
  eval "$var=\"${input:-$default}\""
}

ask_yn() {
  local prompt="$1" default="$2"
  local yn_hint="[Y/n]"
  [ "$default" = "n" ] && yn_hint="[y/N]"
  echo -en "  ${CYAN}?${NC} ${prompt} ${DIM}${yn_hint}${NC}: "
  read -r input
  input="${input:-$default}"
  [[ "$input" =~ ^[Yy] ]]
}

generate_key() {
  openssl rand -hex 24 2>/dev/null || head -c 48 /dev/urandom | xxd -p 2>/dev/null | head -c 48 || echo "commandarr-$(date +%s)-secret"
}

# ─── Pre-flight checks ──────────────────────────────────────────────

banner

# Check Docker
if ! command -v docker &> /dev/null; then
  error "Docker is not installed."
  echo ""
  echo "  Install Docker Desktop from: https://docker.com/products/docker-desktop"
  echo ""
  exit 1
fi

if ! docker info &> /dev/null 2>&1; then
  error "Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

success "Docker is running"

# Check docker compose
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null 2>&1; then
  if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    error "Docker Compose is not available."
    exit 1
  fi
fi

# ─── Detect existing installation ───────────────────────────────────

INSTALL_DIR="$DEFAULT_DIR"
IS_UPDATE=false

if [ -f "./docker-compose.yml" ] && grep -q "commandarr" "./docker-compose.yml" 2>/dev/null; then
  INSTALL_DIR="$(pwd)"
  IS_UPDATE=true
elif [ -f "$DEFAULT_DIR/docker-compose.yml" ]; then
  INSTALL_DIR="$DEFAULT_DIR"
  IS_UPDATE=true
fi

if $IS_UPDATE; then
  echo ""
  info "Existing Commandarr installation found at ${BOLD}$INSTALL_DIR${NC}"
  echo ""

  if ask_yn "Update to the latest version?" "y"; then
    cd "$INSTALL_DIR"
    info "Pulling latest image..."
    docker pull "$IMAGE"
    success "Image updated"

    info "Restarting..."
    $COMPOSE_CMD up -d
    success "Commandarr updated and running!"

    PORT=$(grep -oP '"\K[0-9]+(?=:)' docker-compose.yml 2>/dev/null | head -1 || echo "8484")
    echo ""
    echo -e "  ${GREEN}Dashboard:${NC} http://localhost:${PORT}"
    echo ""

    # Check if helper needs updating
    if [ -f "$HOME/.commandarr-helper/commandarr-helper.js" ]; then
      if ask_yn "Update the Commandarr Helper too?" "y"; then
        curl -fsSL "https://raw.githubusercontent.com/$REPO/main/helper/commandarr-helper.js" -o "$HOME/.commandarr-helper/commandarr-helper.js"
        success "Helper updated"

        # Restart helper
        if [[ "$(uname)" == "Linux" ]] && systemctl is-active commandarr-helper &>/dev/null; then
          sudo systemctl restart commandarr-helper
          success "Helper restarted"
        elif [[ "$(uname)" == "Darwin" ]]; then
          launchctl stop com.commandarr.helper 2>/dev/null
          launchctl start com.commandarr.helper 2>/dev/null
          success "Helper restarted"
        fi
      fi
    fi

    if ask_yn "Reconfigure settings?" "n"; then
      IS_UPDATE=false  # Fall through to configuration
    else
      echo ""
      echo -e "  ${GREEN}All done!${NC} 🛰️"
      echo ""
      exit 0
    fi
  else
    exit 0
  fi
fi

# ─── Fresh Install / Reconfigure ────────────────────────────────────

if ! $IS_UPDATE; then
  echo ""
  echo -e "  ${BOLD}Let's set up Commandarr.${NC}"
  echo ""

  # Install directory
  ask "Install directory" "$DEFAULT_DIR" INSTALL_DIR
  mkdir -p "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

echo ""
echo -e "  ${BOLD}── Core Settings ──${NC}"
echo ""

ask "Dashboard port" "8484" PORT
ENCRYPTION_KEY=$(generate_key)

# ─── Authentication ──────────────────────────────────────────────────

echo ""
echo -e "  ${BOLD}── Authentication ──${NC}"
echo ""

AUTH_USERNAME=""
AUTH_PASSWORD=""
if ask_yn "Enable dashboard authentication?" "y"; then
  ask "Username" "admin" AUTH_USERNAME
  ask "Password" "" AUTH_PASSWORD
  while [ -z "$AUTH_PASSWORD" ]; do
    warn "Password cannot be empty"
    ask "Password" "" AUTH_PASSWORD
  done
  success "Auth enabled: $AUTH_USERNAME / ****"
else
  info "No authentication (dashboard is open)"
fi

# ─── Telegram ────────────────────────────────────────────────────────

echo ""
echo -e "  ${BOLD}── Telegram Bot (optional) ──${NC}"
echo ""

TELEGRAM_TOKEN=""
if ask_yn "Set up Telegram bot?" "n"; then
  echo -e "  ${DIM}Get a token from @BotFather on Telegram${NC}"
  ask "Bot token" "" TELEGRAM_TOKEN
  success "Telegram configured"
fi

# ─── Plex Setup ──────────────────────────────────────────────────────

echo ""
echo -e "  ${BOLD}── Plex Restart Capability ──${NC}"
echo ""
echo -e "  ${DIM}Commandarr can auto-restart Plex when it crashes.${NC}"
echo -e "  ${DIM}How you set this up depends on how Plex is installed.${NC}"
echo ""

HELPER_URL=""
HELPER_TOKEN=""
PLEX_RESTART_CMD=""
DOCKER_SOCK=""

echo -e "  ${BOLD}How is Plex installed?${NC}"
echo -e "    ${CYAN}1)${NC} Bare metal on this machine (Windows/Linux/macOS service)"
echo -e "    ${CYAN}2)${NC} Docker container on this machine"
echo -e "    ${CYAN}3)${NC} Different machine / skip for now"
echo ""
echo -en "  ${CYAN}?${NC} Choice ${DIM}(1/2/3)${NC}: "
read -r PLEX_CHOICE

case "$PLEX_CHOICE" in
  1)
    # Install helper
    echo ""
    info "Installing Commandarr Helper for bare-metal Plex restart..."

    HELPER_DIR="$HOME/.commandarr-helper"
    mkdir -p "$HELPER_DIR"
    curl -fsSL "https://raw.githubusercontent.com/$REPO/main/helper/commandarr-helper.js" -o "$HELPER_DIR/commandarr-helper.js"

    # Check Node.js
    if ! command -v node &> /dev/null; then
      warn "Node.js is required for the helper. Install from https://nodejs.org"
      warn "After installing Node.js, run: node $HELPER_DIR/commandarr-helper.js"
    else
      HELPER_TOKEN=$(generate_key)

      # Write env file
      cat > "$HELPER_DIR/.env" << EOF
HELPER_PORT=$HELPER_PORT
HELPER_TOKEN=$HELPER_TOKEN
EOF

      # Register as service
      if [[ "$(uname)" == "Linux" ]] && command -v systemctl &> /dev/null; then
        sudo tee /etc/systemd/system/commandarr-helper.service > /dev/null << UNIT
[Unit]
Description=Commandarr Helper
After=network.target
[Service]
Type=simple
User=$USER
WorkingDirectory=$HELPER_DIR
EnvironmentFile=$HELPER_DIR/.env
ExecStart=$(which node) $HELPER_DIR/commandarr-helper.js
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
        sudo systemctl daemon-reload
        sudo systemctl enable commandarr-helper
        sudo systemctl start commandarr-helper
        success "Helper installed as systemd service"

      elif [[ "$(uname)" == "Darwin" ]]; then
        PLIST="$HOME/Library/LaunchAgents/com.commandarr.helper.plist"
        cat > "$PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.commandarr.helper</string>
  <key>ProgramArguments</key><array>
    <string>$(which node)</string>
    <string>$HELPER_DIR/commandarr-helper.js</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>HELPER_PORT</key><string>$HELPER_PORT</string>
    <key>HELPER_TOKEN</key><string>$HELPER_TOKEN</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
PLIST
        launchctl load "$PLIST" 2>/dev/null || true
        success "Helper installed as launchd service"
      else
        info "Start the helper manually: HELPER_TOKEN=$HELPER_TOKEN node $HELPER_DIR/commandarr-helper.js"
      fi

      HELPER_URL="http://host.docker.internal:$HELPER_PORT"
      success "Helper configured"
    fi
    ;;
  2)
    ask "Plex container name" "plex" PLEX_CONTAINER
    PLEX_RESTART_CMD="docker restart $PLEX_CONTAINER"
    DOCKER_SOCK="      - /var/run/docker.sock:/var/run/docker.sock"
    success "Docker restart configured for container: $PLEX_CONTAINER"
    ;;
  3)
    info "Skipped — you can configure this later in Settings"
    ;;
esac

# ─── Generate docker-compose.yml ─────────────────────────────────────

echo ""
info "Writing docker-compose.yml..."

cat > "$INSTALL_DIR/docker-compose.yml" << COMPOSE
version: '3.8'
services:
  commandarr:
    image: $IMAGE
    container_name: commandarr
    restart: unless-stopped
    ports:
      - "$PORT:$PORT"
    volumes:
      - ./data:/app/data
$DOCKER_SOCK
    environment:
      - PORT=$PORT
      - ENCRYPTION_KEY=$ENCRYPTION_KEY
COMPOSE

# Add optional env vars
[ -n "$AUTH_USERNAME" ]    && echo "      - AUTH_USERNAME=$AUTH_USERNAME" >> "$INSTALL_DIR/docker-compose.yml"
[ -n "$AUTH_PASSWORD" ]    && echo "      - AUTH_PASSWORD=$AUTH_PASSWORD" >> "$INSTALL_DIR/docker-compose.yml"
[ -n "$TELEGRAM_TOKEN" ]  && echo "      - TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN" >> "$INSTALL_DIR/docker-compose.yml"
[ -n "$HELPER_URL" ]      && echo "      - HELPER_URL=$HELPER_URL" >> "$INSTALL_DIR/docker-compose.yml"
[ -n "$HELPER_TOKEN" ]    && echo "      - HELPER_TOKEN=$HELPER_TOKEN" >> "$INSTALL_DIR/docker-compose.yml"
[ -n "$PLEX_RESTART_CMD" ] && echo "      - PLEX_RESTART_COMMAND=$PLEX_RESTART_CMD" >> "$INSTALL_DIR/docker-compose.yml"

success "docker-compose.yml written"

# ─── Pull and start ──────────────────────────────────────────────────

echo ""
info "Pulling Commandarr image..."
docker pull "$IMAGE"
success "Image pulled"

info "Starting Commandarr..."
cd "$INSTALL_DIR"
$COMPOSE_CMD up -d
success "Commandarr is running!"

# ─── Done ────────────────────────────────────────────────────────────

echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  🛰️  ${BOLD}Commandarr is ready!${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}  http://localhost:$PORT"
[ -n "$AUTH_USERNAME" ] && echo -e "  ${BOLD}Login:${NC}      $AUTH_USERNAME / ****"
echo -e "  ${BOLD}Config:${NC}     $INSTALL_DIR/docker-compose.yml"
echo -e "  ${BOLD}Data:${NC}       $INSTALL_DIR/data/"
echo ""
echo -e "  ${DIM}Next steps:${NC}"
echo -e "    1. Open the dashboard and go to ${BOLD}Settings → LLM Providers${NC}"
echo -e "    2. Add your API key (OpenRouter, OpenAI, etc.)"
echo -e "    3. Go to ${BOLD}Integrations${NC} and connect Plex, Radarr, Sonarr"
echo -e "    4. Start chatting!"
echo ""
echo -e "  ${DIM}To update later:${NC}  cd $INSTALL_DIR && $0"
echo -e "  ${DIM}Or just run:${NC}      curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash"
echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
