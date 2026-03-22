![Commandarr](commandarr-readme.png)

# Commandarr

**The AI brain for your media stack.**

An LLM-powered agent that monitors, controls, and automates your entire Plex/*arr ecosystem — accessible through Telegram, Discord, or a built-in dashboard with AI-generated live widgets.

---

## Install

**One command. That's it.**

```bash
mkdir commandarr && cd commandarr
curl -fsSL https://raw.githubusercontent.com/braedonsaunders/commandarr/main/docker-compose.yml -o docker-compose.yml
docker compose up -d
```

Open **http://localhost:8484** → configure your LLM provider → add your integrations → start chatting.

### What you'll need

- Docker (any machine — Windows, Mac, Linux)
- An LLM API key from any provider: [OpenRouter](https://openrouter.ai), [OpenAI](https://platform.openai.com), [Anthropic](https://console.anthropic.com), Google Gemini, or a local model via [Ollama](https://ollama.com) / [LM Studio](https://lmstudio.ai)

---

## Update

```bash
docker compose pull && docker compose up -d
```

Your settings, credentials, and widgets are stored in `./data/` and persist across updates.

---

## Features

- **Chat with your media stack** — Ask "what's playing?" or "add The Bear to Sonarr" via the dashboard, Telegram, or Discord
- **15 built-in tools** — Health checks, restart, search, add media, download queues, calendars, quality profiles
- **AI-generated widgets** — "Build me a widget showing who's watching Plex" → live auto-refreshing dashboard widget
- **Automations** — Cron-scheduled agent tasks: "check if Plex is up every 5 minutes, restart if down"
- **Wake hooks** — Agent auto-activates when integrations go down or receive webhook events
- **Multi-provider LLM** — OpenRouter, OpenAI, Anthropic, Gemini, Ollama, LM Studio, or any OpenAI-compatible endpoint with automatic fallback
- **Extensible** — Add new integrations by dropping a directory with a manifest + tools

---

## Plex Restart (Optional)

Commandarr can restart Plex when it crashes — even if Plex is installed bare metal (not in Docker). This works across Windows, Linux, and macOS.

### How it works

1. **Plex API restart** — tries the built-in Plex restart endpoint first (works when Plex is responsive)
2. **Commandarr Helper** — a tiny service that runs natively on your host machine, performs OS-level restart when Plex is completely frozen

### Install the Helper

The helper runs on the **same machine as Plex** (not inside Docker). It auto-detects your OS and restart method.

**Windows** (PowerShell as Admin):
```powershell
irm https://raw.githubusercontent.com/braedonsaunders/commandarr/main/helper/install.ps1 | iex
```

**Linux / macOS**:
```bash
curl -fsSL https://raw.githubusercontent.com/braedonsaunders/commandarr/main/helper/install.sh | bash
```

The installer will:
1. Download the helper script
2. Generate a secure auth token
3. Register it as a startup service (systemd / launchd / Windows Task Scheduler)
4. Print the `HELPER_URL` and `HELPER_TOKEN` to add to your Commandarr container

### Connect the Helper

Add the values from the installer output to your `docker-compose.yml`:

```yaml
environment:
  - HELPER_URL=http://host.docker.internal:9484
  - HELPER_TOKEN=your-generated-token
```

Then `docker compose up -d` to apply. Now you can say "restart Plex" in chat or Telegram, or set up an automation to auto-restart when Plex goes down.

---

## Configuration

All configuration is done through the web dashboard at `http://localhost:8484/settings`.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Dashboard port | `8484` |
| `ENCRYPTION_KEY` | Encryption key for stored credentials | `commandarr-change-this-key` |
| `AUTH_USERNAME` | Basic auth username (both required to enable) | — |
| `AUTH_PASSWORD` | Basic auth password | — |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | — |
| `HELPER_URL` | Commandarr Helper URL for host-level actions | — |
| `HELPER_TOKEN` | Shared secret for helper authentication | — |

### Full Docker Compose

```yaml
version: '3.8'
services:
  commandarr:
    image: ghcr.io/braedonsaunders/commandarr:latest
    container_name: commandarr
    restart: unless-stopped
    ports:
      - "8484:8484"
    volumes:
      - ./data:/app/data
    environment:
      - ENCRYPTION_KEY=pick-a-secret-key
      # Optional: basic auth
      # - AUTH_USERNAME=admin
      # - AUTH_PASSWORD=changeme
      # Optional: Telegram bot
      # - TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
      # Optional: Plex restart helper
      # - HELPER_URL=http://host.docker.internal:9484
      # - HELPER_TOKEN=your-token
```

---

## Supported Integrations

| Integration | Tools | Description |
|-------------|-------|-------------|
| **Plex** | 5 | Health check, restart, now playing, libraries, search |
| **Radarr** | 5 | Search movies, add by TMDB ID, download queue, calendar, quality profiles |
| **Sonarr** | 5 | Search shows, add by TVDB ID, download queue, calendar, quality profiles |

Adding your own integration? Copy `src/integrations/_template/` and follow the pattern. Commandarr auto-discovers new integrations on startup.

---

## Development

```bash
git clone https://github.com/braedonsaunders/commandarr.git
cd commandarr

# Backend
bun install
bun run dev

# Frontend (separate terminal)
cd web && bun install && bun run dev
```

The frontend dev server proxies API requests to `localhost:8484`.

---

## License

MIT
