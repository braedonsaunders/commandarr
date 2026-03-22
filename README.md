![Commandarr](commandarr-readme.png)

# Commandarr

**The AI brain for your media stack.**

An LLM-powered agent that monitors, controls, and automates your entire Plex/*arr ecosystem — accessible through Telegram, Discord, or a built-in dashboard with AI-generated live widgets.

---

## Install

One command. It handles everything — installs, updates, configures Docker, sets up Plex restart, the works.

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/braedonsaunders/commandarr/main/install.sh | bash
```

**Windows** (PowerShell as Admin):
```powershell
iwr https://raw.githubusercontent.com/braedonsaunders/commandarr/main/install.ps1 -OutFile install.ps1; powershell -ExecutionPolicy Bypass -File install.ps1
```

The installer will:
1. Check Docker is running
2. Ask you a few questions (port, auth, Telegram, Plex setup)
3. Generate your `docker-compose.yml`
4. Pull and start Commandarr
5. Optionally install the Plex restart helper

**Run the same command again to update.** Your data persists automatically.

### Requirements

- [Docker Desktop](https://docker.com/products/docker-desktop) (Windows, Mac, or Linux)
- An LLM API key — [OpenRouter](https://openrouter.ai) (recommended, multi-model), [OpenAI](https://platform.openai.com), [Anthropic](https://console.anthropic.com), [Google Gemini](https://aistudio.google.com), or local via [Ollama](https://ollama.com) / [LM Studio](https://lmstudio.ai)

---

## Features

- **Chat with your entire media stack** — "What's playing?" / "Add The Bear to Sonarr" / "Approve all pending requests" / "Why are there no subtitles for X?" via dashboard, Telegram, or Discord
- **60+ built-in tools** — Health checks, restart, search, add media, download queues, subtitle management, request approvals, indexer stats, and more across 11 integrations
- **AI-generated live widgets** — "Build me a widget showing who's watching Plex" → auto-refreshing dashboard widget with real-time data
- **Automations** — Cron-scheduled tasks: "Check Plex every 5 minutes, restart if down, notify me on Telegram"
- **Wake hooks** — Agent auto-activates when services go down or receive webhook events
- **Plex auto-restart** — Works on bare metal (Windows/Linux/macOS) and Docker installs
- **Multi-provider LLM** — OpenRouter, OpenAI, Anthropic, Gemini, Ollama, LM Studio, or any OpenAI-compatible endpoint with automatic fallback chain
- **Extensible** — Add new integrations by dropping a directory with a manifest + tools

---

## Supported Integrations

### Media Servers
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Plex** | 5 | Health check, restart, now playing, libraries, search |
| **Jellyfin** | 6 | Health check, now playing, libraries, search, recently added, users |

### Media Management
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Radarr** | 5 | Search movies, add by TMDB ID, download queue, calendar, quality profiles |
| **Sonarr** | 5 | Search shows, add by TVDB ID, download queue, calendar, quality profiles |
| **Lidarr** | 5 | Search artists, add by MusicBrainz ID, download queue, calendar, quality profiles |
| **Bazarr** | 6 | Wanted movies/episodes, subtitle history, manual search, providers, system status |

### Download Clients
| Integration | Tools | Description |
|-------------|-------|-------------|
| **SABnzbd** | 6 | Queue, history, status, pause/resume, add NZB, speed limit |
| **qBittorrent** | 5 | Torrents list, transfer status, pause/resume, add torrent, speed limit |

### Indexers & Requests
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Prowlarr** | 5 | Indexer list, indexer stats, cross-indexer search, test indexer, health warnings |
| **Seerr** | 6 | List/approve/decline requests, search, trending, users (Overseerr/Jellyseerr compatible) |

### Monitoring
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Tautulli** | 6 | Current activity, watch history, recently added, most watched, users, server info |

### Coming Soon

We're building toward full-stack coverage. Planned integrations:

- **Readarr** — Book/audiobook management (same *arr API)
- **Whisparr** — Adult content management (same *arr API)
- **Mylar3** — Comic book management
- **Emby** — Alternative media server
- **Transmission** — Alternative torrent client
- **Deluge** — Alternative torrent client
- **NZBGet** — Alternative Usenet client
- **Unpackerr** — Automated archive extraction
- **Recyclarr** — TRaSH Guides sync (quality profile automation)
- **Notifiarr** — Notification aggregation
- **Nginx Proxy Manager** — Reverse proxy management
- **Portainer** — Docker container management
- **Uptime Kuma** — Service uptime monitoring
- **Watchtower** — Docker image auto-updates
- **Homepage** — Dashboard data sync

Community integrations welcome — copy `src/integrations/_template/` and follow the pattern.

---

## How Plex Restart Works

Commandarr uses a layered restart strategy that works regardless of how Plex is installed:

| Plex Setup | Method | How to Enable |
|-----------|--------|---------------|
| **Any** | Plex API restart | Automatic — always tried first |
| **Bare metal** (Windows/Linux/macOS) | Commandarr Helper | Installer sets it up for you |
| **Docker container** | `docker restart` | Set `PLEX_RESTART_COMMAND` + mount Docker socket |

The installer handles all of this automatically based on your answers.

---

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Dashboard port | `8484` |
| `ENCRYPTION_KEY` | Key for encrypting stored credentials | auto-generated |
| `AUTH_USERNAME` | Basic auth username (set both to enable) | — |
| `AUTH_PASSWORD` | Basic auth password | — |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | — |
| `HELPER_URL` | Commandarr Helper URL (bare metal Plex restart) | — |
| `HELPER_TOKEN` | Helper auth token | — |
| `PLEX_RESTART_COMMAND` | Command to restart Plex (Docker setups) | — |

---

## Development

```bash
git clone https://github.com/braedonsaunders/commandarr.git
cd commandarr
bun install && cd web && bun install && cd ..
bun run dev        # backend
cd web && bun run dev  # frontend (separate terminal)
```

---

## License

MIT
