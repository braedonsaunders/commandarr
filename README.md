![Commandarr](commandarr-readme.png)

# Commandarr

**The AI brain for your media stack.**

An LLM-powered agent that monitors, controls, and automates your entire Plex/*arr ecosystem through a built-in dashboard, Telegram, and an expanding set of chat + automation surfaces. Installable as a PWA on mobile.

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

- **Chat with your entire media stack** — "What's playing?" / "Add The Bear to Sonarr" / "Approve all pending requests" / "Why are there no subtitles for X?" / "Dim the lights for movie night" via dashboard, Telegram, or Discord
- **100+ built-in tools** — Health checks, restart, search, add media, download queues, subtitle management, request approvals, indexer stats, smart home control, and more across 19 integrations
- **Cross-service orchestration** — The agent reasons across your entire stack: "Something's downloading slowly, figure out why" checks download clients, indexers, and network in one shot
- **Natural language automations** — "Every morning, check if anything downloaded overnight and send me a summary" — no cron expressions needed
- **AI-generated live widgets** — "Build me a widget showing who's watching Plex" → auto-refreshing dashboard widget with real-time data
- **Mobile PWA** — Install on your phone homescreen with quick-action buttons for pause downloads, restart Plex, approve requests, and more
- **Wake hooks** — Agent auto-activates when services go down or receive webhook events
- **Plex auto-restart** — Works on bare metal (Windows/Linux/macOS) and Docker installs
- **Multi-provider LLM** — OpenRouter, OpenAI, Anthropic, Gemini, Ollama, LM Studio, or any OpenAI-compatible endpoint with automatic fallback chain
- **Home Assistant integration** — Control lights, scenes, and automations. "Activate movie night" dims the lights and starts the player
- **Extensible** — Add new integrations by dropping a directory with a manifest + tools

---

## Supported Integrations

### Media Servers
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Plex** | 5 | Health check, restart, now playing, libraries, search |
| **Jellyfin** | 6 | Health check, now playing, libraries, search, recently added, users |
| **Emby** | 6 | Health check, now playing, libraries, search, recently added, users |

### Media Management
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Radarr** | 5 | Search movies, add by TMDB ID, download queue, calendar, quality profiles |
| **Sonarr** | 5 | Search shows, add by TVDB ID, download queue, calendar, quality profiles |
| **Lidarr** | 5 | Search artists, add by MusicBrainz ID, download queue, calendar, quality profiles |
| **Readarr** | 5 | Search authors, add by GoodReads ID, download queue, calendar, quality profiles |
| **Whisparr** | 5 | Search titles, add by TMDB ID, download queue, calendar, quality profiles |
| **Bazarr** | 6 | Wanted movies/episodes, subtitle history, manual search, providers, system status |

### Download Clients
| Integration | Tools | Description |
|-------------|-------|-------------|
| **SABnzbd** | 6 | Queue, history, status, pause/resume, add NZB, speed limit |
| **NZBGet** | 6 | Queue, history, status, pause/resume, add NZB, speed limit |
| **qBittorrent** | 5 | Torrents list, transfer status, pause/resume, add torrent, speed limit |
| **Transmission** | 5 | Torrents list, transfer status, pause/resume, add torrent, speed limit |
| **Deluge** | 5 | Torrents list, transfer status, pause/resume, add torrent, speed limit |
| **Unpackerr** | 3 | Extraction status, history, active queue |

### Indexers & Requests
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Prowlarr** | 5 | Indexer list, indexer stats, cross-indexer search, test indexer, health warnings |
| **Seerr** | 6 | List/approve/decline requests, search, trending, users (Overseerr/Jellyseerr compatible) |

### Monitoring & Analytics
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Tautulli** | 6 | Current activity, watch history, recently added, most watched, users, server info |

### Smart Home
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Home Assistant** | 7 | Entity states, call service, scenes, activate scene, history, automations, trigger automation |

### System Tools
| Tool | Description |
|------|-------------|
| `commandarr_diagnose` | Health check across all configured integrations in one shot |
| `commandarr_stack_summary` | Active streams, download queues, pending requests — full stack at a glance |
| `commandarr_create_automation` | Create automations with natural language schedules |
| `commandarr_list_automations` | List all automations with status and next run |
| `commandarr_toggle_automation` | Enable/disable automations by name or ID |
| `commandarr_create_widget` | AI-generated live dashboard widgets |

### Coming Soon

- **Audiobookshelf** — Books and audiobooks paired with Readarr
- **Komga / Kavita** — Manga, comics, and ebooks
- **Tdarr / FileFlows** — Transcoding management
- **Recyclarr** — TRaSH Guides quality profile sync
- **Notifiarr** — Notification aggregation hub
- **Portainer** — Docker container management
- **Uptime Kuma** — Service uptime monitoring
- **Mylar3** — Comic book management

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
