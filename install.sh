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

    echo ""
    echo -e "  ${GREEN}All done!${NC} 🛰️"
    echo ""
    exit 0
  else
    exit 0
  fi
fi

# ─── Fresh Install ───────────────────────────────────────────────────

echo ""
echo -e "  ${BOLD}Let's set up Commandarr.${NC}"
echo ""

# Install directory
ask "Install directory" "$DEFAULT_DIR" INSTALL_DIR
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo ""
echo -e "  ${BOLD}── Core Settings ──${NC}"
echo ""

ask "Dashboard port" "8484" PORT
ENCRYPTION_KEY=$(generate_key)

# ─── Plex Helper Setup (optional) ────────────────────────────────────

DOCKER_SOCK=""

echo ""
echo -e "  ${BOLD}── Plex Restart Capability (optional) ──${NC}"
echo ""
echo -e "  ${DIM}Commandarr can auto-restart Plex when it crashes.${NC}"
echo -e "  ${DIM}If Plex runs in Docker on this machine, we need the Docker socket.${NC}"
echo ""

if ask_yn "Does Plex run as a Docker container on this machine?" "n"; then
  DOCKER_SOCK="      - /var/run/docker.sock:/var/run/docker.sock"
  success "Docker socket will be mounted"
fi

# ─── Generate docker-compose.yml ─────────────────────────────────────

echo ""
info "Writing docker-compose.yml..."

cat > "$INSTALL_DIR/docker-compose.yml" << COMPOSE
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

success "docker-compose.yml written"

# ─── Pull and start ──────────────────────────────────────────────────

echo ""
info "Pulling Commandarr image..."
docker pull "$IMAGE"
success "Image pulled"

info "Starting Commandarr..."
cd "$INSTALL_DIR"

# Remove any existing commandarr container that would conflict
if docker ps -a --filter "name=^/commandarr$" --format "{{.ID}}" 2>/dev/null | grep -q .; then
  info "Removing old commandarr container..."
  docker rm -f commandarr >/dev/null 2>&1
fi

$COMPOSE_CMD up -d
success "Commandarr is running!"

# ─── Done ────────────────────────────────────────────────────────────

echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  🛰️  ${BOLD}Commandarr is ready!${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}  http://localhost:$PORT"
echo -e "  ${BOLD}Config:${NC}     $INSTALL_DIR/docker-compose.yml"
echo -e "  ${BOLD}Data:${NC}       $INSTALL_DIR/data/"
echo ""
echo -e "  ${DIM}Next steps:${NC}"
echo -e "    1. Open the dashboard and go to ${BOLD}Settings${NC}"
echo -e "    2. Configure authentication, Telegram, Discord, etc."
echo -e "    3. Add your LLM API key (Settings → LLM Providers)"
echo -e "    4. Go to ${BOLD}Integrations${NC} and connect Plex, Radarr, Sonarr"
echo -e "    5. Start chatting!"
echo ""
echo -e "  ${DIM}All settings are configured in the dashboard — no env vars needed.${NC}"
echo ""
echo -e "  ${DIM}To update later:${NC}  cd $INSTALL_DIR && $0"
echo -e "  ${DIM}Or just run:${NC}      curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash"
echo ""
echo -e "  ${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
