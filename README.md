![Commandarr](commandarr-readme.png)

# Commandarr

**The AI brain for your media stack.**

An LLM-powered agent that monitors, controls, and automates your entire Plex/*arr ecosystem through a built-in dashboard, Telegram, and an expanding set of chat + automation surfaces.

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

- **Chat with your entire media stack** — "What's playing?" / "Add The Bear to Sonarr" / "Approve all pending requests" / "Why are there no subtitles for X?" via the dashboard or Telegram today, with more chat surfaces on the roadmap
- **90+ built-in tools** — Health checks, restart, search, add media, download queues, subtitle management, request approvals, indexer stats, and more across 18 integrations
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
| **Emby** | 1+ | Early support today; health check is in place and playback/library tooling is a strong next target |

### Media Management
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Radarr** | 5 | Search movies, add by TMDB ID, download queue, calendar, quality profiles |
| **Sonarr** | 5 | Search shows, add by TVDB ID, download queue, calendar, quality profiles |
| **Lidarr** | 5 | Search artists, add by MusicBrainz ID, download queue, calendar, quality profiles |
| **Readarr** | 5 | Search books, add titles, download queue, calendar, quality profiles |
| **Whisparr** | 5 | Search titles, add content, download queue, calendar, quality profiles |
| **Bazarr** | 6 | Wanted movies/episodes, subtitle history, manual search, providers, system status |

### Download Clients
| Integration | Tools | Description |
|-------------|-------|-------------|
| **SABnzbd** | 6 | Queue, history, status, pause/resume, add NZB, speed limit |
| **qBittorrent** | 5 | Torrents list, transfer status, pause/resume, add torrent, speed limit |
| **Transmission** | 5 | Torrents list, transfer status, pause/resume, add torrent, speed limit |
| **Deluge** | 5 | Torrents list, transfer status, pause/resume, add torrent, speed limit |
| **NZBGet** | 4 | Queue, history, status, pause/resume |
| **Unpackerr** | 1+ | Extraction status today, with room to expand into stuck-unpack diagnostics |

### Indexers & Requests
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Prowlarr** | 5 | Indexer list, indexer stats, cross-indexer search, test indexer, health warnings |
| **Seerr** | 6 | List/approve/decline requests, search, trending, users (Overseerr/Jellyseerr compatible) |

### Monitoring
| Integration | Tools | Description |
|-------------|-------|-------------|
| **Tautulli** | 6 | Current activity, watch history, recently added, most watched, users, server info |

Coverage varies by integration, but the goal is simple: Commandarr should understand the entire request → indexer → downloader → importer → subtitles → playback chain, not just individual apps in isolation.

### High-Impact Integrations To Build Next

If the goal is "people in r/selfhosted immediately get why this matters," these are the best next bets:

- **Audiobookshelf** — Books and audiobooks are a huge adjacent use case, and it pairs naturally with Readarr
- **Komga or Kavita** — Manga/comics/ebooks would widen the audience beyond the classic Plex + Sonarr + Radarr stack
- **Notifiarr** — Lets Commandarr plug into a notification hub the *arr community already trusts
- **Recyclarr** — Quality profile and custom format sync would make Commandarr useful even when people are not actively chatting with it
- **Tdarr / FileFlows / Unmanic** — "Why is this transcode job backing up?" is exactly the kind of cross-service AI workflow people remember
- **Mylar3** — A natural complement to the comics/reading ecosystem
- **Uptime Kuma** — Strong for service health, incident timelines, and "what changed?" troubleshooting
- **Portainer** — Gives the agent a safe operational surface for container restarts and deployment visibility
- **Home Assistant** — Opens the door to richer household automations like quiet hours, power-aware downloads, and presence-based actions
- **Discord** — Not a media integration, but a big adoption unlock because communities already live there

Community integrations are welcome: copy `src/integrations/_template/` and follow the pattern.

---

## What Would Make Commandarr World-Class

The big opportunity is not just "more tools." It is making the whole stack feel understandable and self-healing.

- **Cross-stack diagnosis** — Answer "why is this missing?" by tracing the full chain from request, to indexer, to downloader, to import, to subtitles, to playback
- **Safe operator mode** — Dry runs, approval gates, audit logs, and undo-friendly actions so users trust the agent with real admin tasks
- **Opinionated automations** — Ship prebuilt recipes like "heal Plex," "clear stalled downloads," "nightly subtitle sweep," and "approve requests from trusted users"
- **Auto-discovery and setup** — Detect common containers/services on the local network and pre-fill integration settings instead of making users hunt for every URL and API key
- **Shareable widgets and playbooks** — Let the community publish prompts, automations, and dashboard widgets the way Home Assistant users share blueprints
- **Memory and preferences** — Learn house rules like preferred qualities, quiet hours, request policies, and who gets auto-approved
- **Event timeline + incident review** — Show a clean narrative of what happened across services when something breaks
- **Plugin SDK that feels great** — Excellent docs, examples, test harnesses, and a dead-simple packaging flow for community-built integrations
- **First-class mobile/chat UX** — Telegram is a strong start; Discord, push notifications, and excellent read-only mobile dashboards would multiply daily usage
- **Recommendations with actionability** — Do not just show stats; suggest fixes, explain tradeoffs, and offer one-tap remediation

If Commandarr becomes the fastest way to understand, fix, and improve a self-hosted media stack, the community will market it for you.

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
