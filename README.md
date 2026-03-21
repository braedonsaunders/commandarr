![Commandarr](commandarr-readme.png)

# Commandarr

**The AI brain for your media stack.**

An LLM-powered agent that monitors, controls, and automates your entire Plex/*arr ecosystem — accessible through Telegram, Discord, or a built-in dashboard with AI-generated live widgets.

## Quick Start

```bash
docker compose up -d
```

Open `http://localhost:8484` and configure your integrations + LLM provider.

## Features

- **Multi-Provider LLM** — OpenRouter, OpenAI, Anthropic, Google Gemini, Ollama, LM Studio, or any OpenAI-compatible endpoint. Automatic fallback chain.
- **15 Built-in Tools** — Health checks, restart, search, add media, download queues, calendars, quality profiles across Plex, Radarr, and Sonarr.
- **Telegram Bot** — Chat with your media stack from anywhere.
- **Automations** — Cron-scheduled agent tasks ("restart Plex if down", "add trending movies weekly").
- **Wake Hooks** — Event-driven LLM triggers when integrations go down/recover or receive webhooks.
- **AI Widgets** — Describe a dashboard widget in plain English, Commandarr generates it.
- **Extensible** — Add new integrations by dropping a directory with a manifest + tools.

## Docker Compose

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
      - ./integrations:/app/custom-integrations
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-change-me}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
```

## Supported Integrations

| Integration | Tools | Description |
|-------------|-------|-------------|
| **Plex** | 5 | Health check, restart, now playing, libraries, search |
| **Radarr** | 5 | Search movies, add by TMDB ID, download queue, calendar, quality profiles |
| **Sonarr** | 5 | Search shows, add by TVDB ID, download queue, calendar, quality profiles |

Community integrations welcome — copy `src/integrations/_template/` and add your service.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Backend | Hono |
| Database | SQLite + Drizzle ORM |
| Frontend | React 18 + Vite + Tailwind + Framer Motion |
| Chat | grammy (Telegram) |
| LLM | Multi-provider abstraction |
| Deployment | Docker |

## Development

```bash
# Install dependencies
bun install
cd web && bun install

# Run dev server
bun run dev

# Run frontend dev server (with API proxy)
cd web && bun run dev
```

## License

MIT
