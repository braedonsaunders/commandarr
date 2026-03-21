# Commandarr

**The AI brain for your media stack.**

An LLM-powered agent that monitors, controls, and automates your entire Plex/*arr ecosystem — interacted with through Telegram, Discord, or a built-in dashboard with AI-generated live widgets.

---

## Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | **Bun** | Native TS, built-in SQLite, fast startup, Docker-friendly |
| Backend Framework | **Hono** | Minimal, middleware-ready, WebSocket support, runs on Bun |
| Database | **SQLite** via **Drizzle ORM** | Zero config, type-safe schema, migrations baked in |
| Frontend | **React 18 + Vite** | Fast HMR, monorepo-friendly |
| UI Kit | **shadcn/ui + Tailwind + TanStack Query + TanStack Table** | Pre-built dark components, async state management, sortable/filterable tables out of the box |
| Chat | **grammy** (Telegram) + adapter interface | Best Bun-compatible bot lib, abstracted for Discord/Slack/Matrix later |
| LLM | **Multi-provider abstraction** (see below) | Users choose their backend |
| Deployment | **Docker Compose** single service | One command install, `docker-compose up -d` |

### Why This Stack

- **shadcn/ui** gives us a complete dark-mode component library (dialogs, tabs, forms, toasts, command palette) without building anything custom. The *arr community expects polished dark UIs.
- **TanStack Query** handles all service polling, cache invalidation, and optimistic updates for the dashboard. No Redux, no state management boilerplate.
- **TanStack Table** gives sortable/filterable/paginated tables for media libraries, automation logs, etc. with zero custom table code.
- **Drizzle** gives us type-safe SQLite with zero codegen and migration support — perfect for a single-binary Docker deployment.
- **Hono** serves the API, the frontend build, and WebSocket connections for live widgets all from one process.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         COMMANDARR                              │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Telegram  │  │   Web UI     │  │   Scheduler (cron)        │ │
│  │ Discord   │→ │   Dashboard  │  │   "every 5m check plex"   │ │
│  │ Slack     │  │   Widgets    │  │   "daily add trending"    │ │
│  └─────┬─────┘  └──────┬───────┘  └────────────┬──────────────┘ │
│        │               │                        │               │
│        ▼               ▼                        ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AGENT CORE                            │   │
│  │  System prompt + conversation history + tool definitions │   │
│  │  → LLM Provider (OpenRouter/OpenAI/Anthropic/etc)       │   │
│  │  → Tool call routing                                    │   │
│  │  → Response formatting                                  │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 INTEGRATION REGISTRY                     │   │
│  │                                                          │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐  │   │
│  │  │  Plex   │ │ Radarr  │ │ Sonarr  │ │  Community   │  │   │
│  │  │         │ │         │ │         │ │  Plugins     │  │   │
│  │  │ health  │ │ search  │ │ search  │ │              │  │   │
│  │  │ restart │ │ add     │ │ add     │ │  manifest    │  │   │
│  │  │ status  │ │ delete  │ │ delete  │ │  + tools     │  │   │
│  │  │ nowplay │ │ queue   │ │ queue   │ │  + creds UI  │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SQLite: conversations, automations, widgets, creds,     │   │
│  │          integration state, audit log                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## LLM Provider System

### Multi-Provider Abstraction

```
src/llm/
├── provider.ts          # Abstract provider interface
├── providers/
│   ├── openrouter.ts    # OpenRouter (multi-model)
│   ├── openai.ts        # OpenAI direct
│   ├── anthropic.ts     # Anthropic direct
│   ├── google.ts        # Google Gemini
│   ├── lmstudio.ts      # Local LM Studio (OpenAI-compatible)
│   ├── ollama.ts        # Local Ollama
│   └── custom.ts        # Any OpenAI-compatible endpoint
└── router.ts            # Provider selection + fallback chain
```

### Provider Interface

```typescript
interface LLMProvider {
  id: string;
  name: string;
  // What the settings UI needs to render
  configSchema: {
    fields: ConfigField[];       // API key, base URL, model select, etc.
    testPrompt?: string;         // Used by "Test Connection" button
  };
  // Runtime
  chat(messages: Message[], tools: ToolDef[]): AsyncGenerator<StreamChunk>;
  listModels(): Promise<Model[]>;
  supportsToolUse(): boolean;
  supportsStreaming(): boolean;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'url' | 'number';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];  // For select fields
  default?: string;
}
```

### Provider Configuration (Settings UI auto-renders from schema)

Each provider declares its config fields. The settings page renders them dynamically — no custom UI per provider.

**OpenRouter**: API key, model selector (fetched from their /models endpoint)
**OpenAI**: API key, model selector, optional org ID
**Anthropic**: API key, model selector
**Google**: API key, model selector
**LM Studio**: Base URL (default `http://localhost:1234`), model selector (fetched from /v1/models)
**Ollama**: Base URL (default `http://localhost:11434`), model selector (fetched from /api/tags)
**Custom**: Base URL, API key, model name (any OpenAI-compatible endpoint)

### Fallback Chain

Users configure a priority list. If the primary provider fails (rate limit, timeout, down), Commandarr falls through to the next. Configured in the UI as a drag-and-drop ordered list.

---

## Integration System

This is the core extension point. An integration is a **self-contained directory** with a manifest, credential schema, tools, and optional webhooks.

### Directory Structure

```
src/integrations/
├── _base.ts                    # Base classes + types
├── plex/
│   ├── manifest.ts             # Integration metadata + credential schema
│   ├── client.ts               # API client (typed, handles auth)
│   ├── tools/
│   │   ├── health-check.ts     # Tool: check if Plex is responding
│   │   ├── restart.ts          # Tool: restart Plex service
│   │   ├── now-playing.ts      # Tool: what's currently playing
│   │   ├── libraries.ts        # Tool: list libraries + stats
│   │   └── search.ts           # Tool: search media
│   ├── webhooks.ts             # Optional: handle Plex webhooks
│   └── README.md               # Integration docs (shown in UI)
├── radarr/
│   ├── manifest.ts
│   ├── client.ts
│   ├── tools/
│   │   ├── search.ts           # Tool: search for movies
│   │   ├── add.ts              # Tool: add movie to library
│   │   ├── queue.ts            # Tool: check download queue
│   │   ├── calendar.ts         # Tool: upcoming releases
│   │   └── profiles.ts         # Tool: list quality profiles
│   ├── webhooks.ts
│   └── README.md
├── sonarr/
│   ├── manifest.ts
│   ├── client.ts
│   ├── tools/
│   │   ├── search.ts
│   │   ├── add.ts
│   │   ├── queue.ts
│   │   ├── calendar.ts
│   │   └── profiles.ts
│   ├── webhooks.ts
│   └── README.md
└── _template/                  # Scaffolding for community devs
    ├── manifest.ts
    ├── client.ts
    ├── tools/
    │   └── example-tool.ts
    └── README.md
```

### Integration Manifest

```typescript
// src/integrations/plex/manifest.ts
import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'plex',
  name: 'Plex Media Server',
  description: 'Monitor and control your Plex Media Server',
  icon: 'tv',                       // Lucide icon name
  color: '#E5A00D',                  // Brand color for UI
  version: '1.0.0',

  // Credential schema — the Settings UI renders this automatically
  credentials: [
    {
      key: 'url',
      label: 'Plex Server URL',
      type: 'url',
      required: true,
      placeholder: 'http://192.168.1.100:32400',
      helpText: 'The URL of your Plex Media Server'
    },
    {
      key: 'token',
      label: 'Plex Token',
      type: 'password',
      required: true,
      helpText: 'Found in Plex settings under XML data',
      docsUrl: 'https://support.plex.tv/articles/204059436/'
    }
  ],

  // Health check — called by "Test Connection" button and periodic monitoring
  healthCheck: {
    endpoint: '/identity',     // Relative to base URL
    interval: 60_000,          // Poll every 60s
    timeout: 5_000,
  },

  // Optional webhook configuration
  webhooks: {
    path: '/webhooks/plex',
    description: 'Receives Plex server events (playback, library updates)'
  }
};
```

### Tool Definition

```typescript
// src/integrations/plex/tools/restart.ts
import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  // Identity
  name: 'plex_restart',
  integration: 'plex',

  // What the LLM sees
  description: 'Restart the Plex Media Server. Use when Plex is unresponsive or after configuration changes.',
  parameters: {
    type: 'object',
    properties: {
      confirm: {
        type: 'boolean',
        description: 'Must be true to execute restart. Always ask user to confirm first.'
      }
    },
    required: ['confirm']
  },

  // What the UI shows in the tool testing panel
  ui: {
    category: 'Management',
    dangerLevel: 'high',         // Renders with red warning in UI
    testable: true,              // Shows "Test" button in integration settings
    testDefaults: { confirm: true }
  },

  // Execution
  handler: async (params, ctx) => {
    if (!params.confirm) {
      return { success: false, message: 'Restart not confirmed by user.' };
    }

    const client = ctx.getClient('plex');

    // Check if Plex is actually running first
    const health = await client.get('/identity').catch(() => null);
    const wasRunning = health !== null;

    // Trigger restart via Plex API
    await client.put('/server/restart');

    // Wait and verify it came back
    let attempts = 0;
    while (attempts < 12) {
      await new Promise(r => setTimeout(r, 5000));
      const alive = await client.get('/identity').catch(() => null);
      if (alive) {
        return {
          success: true,
          message: `Plex restarted successfully. Was ${wasRunning ? 'running' : 'not responding'} before. Back online after ${(attempts + 1) * 5}s.`
        };
      }
      attempts++;
    }

    return {
      success: false,
      message: 'Plex did not come back online within 60 seconds. Manual intervention may be needed.'
    };
  }
};
```

### Integration Registry (auto-discovery)

```typescript
// src/integrations/registry.ts
// On startup, scans all directories in src/integrations/
// For each: loads manifest.ts, discovers tools/*.ts, registers webhooks
// Exposes:
//   registry.getIntegrations()        → all available integrations
//   registry.getTools()               → all tool definitions (for LLM system prompt)
//   registry.getTools('plex')         → tools for specific integration
//   registry.executeool(name, params) → run a tool
//   registry.healthCheck(id)          → test connection for an integration
```

---

## Web UI — Pages & Layout

### Layout

Standard *arr-style sidebar navigation. Dark theme. shadcn/ui components throughout.

```
┌─────────────────────────────────────────────────────┐
│ ☰ Commandarr                              🟢 Agent │
├────────────┬────────────────────────────────────────┤
│            │                                        │
│ 📊 Dash    │   [Page Content]                       │
│ 💬 Chat    │                                        │
│ 🔌 Integr  │                                        │
│ ⚡ Autom   │                                        │
│ 🧩 Widgets │                                        │
│ 🤖 LLM     │                                        │
│ ⚙ Settings │                                        │
│            │                                        │
│            │                                        │
│ 📋 Logs    │                                        │
└────────────┴────────────────────────────────────────┘
```

### Pages

#### 1. Dashboard (`/`)
- Grid of user-placed widgets (drag-and-drop via `@dnd-kit/core`)
- Default widgets: System Status (all integration health), Now Playing, Download Queue, Recent Additions
- "Add Widget" button opens widget gallery (pre-built + AI-generated)

#### 2. Chat (`/chat`)
- Full conversation interface with the agent
- Message history persisted in SQLite
- Tool calls shown inline as collapsible cards (shadcn `Collapsible`)
- Streaming responses via WebSocket
- "Suggested actions" quick-buttons below input

#### 3. Integrations (`/integrations`)
- Grid of available integrations, each as a card
- Card shows: icon, name, connection status (green/yellow/red dot), tool count
- Click → integration detail page:
  - **Credentials tab**: Auto-rendered form from manifest schema + "Test Connection" button
  - **Tools tab**: List of all tools with descriptions, danger levels, and individual "Test" buttons
  - **Webhooks tab**: Shows webhook URL to configure in the external service, recent events log
  - **Docs tab**: Renders the integration's README.md
- "Browse Community Integrations" link → GitHub repo's integrations directory

#### 4. Automations (`/automations`)
- TanStack Table of all automations: name, schedule (human-readable cron), last run, next run, status, actions
- "New Automation" dialog:
  - Name field
  - Schedule builder (cron presets: every 5m, hourly, daily, weekly + custom cron input)
  - Prompt field (what to tell the agent when triggered)
  - Conditions (optional): only run if [integration] is [healthy/unhealthy]
  - Notification: where to send results (Telegram/Discord/none)
- Each automation row expandable to show run history with agent responses

#### 5. Widgets (`/widgets`)
- Gallery of all widgets (pre-built + user-created)
- Each widget card shows: preview thumbnail, name, data sources, created date
- "Create Widget" → opens dialog with prompt input
  - User describes widget in natural language
  - Agent generates HTML/JS/CSS
  - Preview renders immediately
  - "Save to Dashboard" or "Edit" buttons
- Edit mode: side-by-side code editor (CodeMirror) + live preview

#### 6. LLM Settings (`/settings/llm`)
- Provider configuration (forms rendered from provider schemas)
- Model selector per provider
- Fallback chain (drag-and-drop priority list)
- System prompt override (advanced, collapsible)
- Token usage tracking (chart via recharts)
- "Test" button per provider that sends a simple prompt and shows response + latency

#### 7. Settings (`/settings`)
- General: app name, port, timezone
- Chat platforms: Telegram bot token, Discord bot token, etc.
- Security: PIN/password for web UI
- Backup: export/import SQLite database
- About: version, update check, links

#### 8. Logs (`/logs`)
- Real-time log stream (WebSocket)
- Filterable by: level (info/warn/error), source (agent/integration/scheduler), integration
- Searchable
- Auto-scroll with pause-on-scroll

---

## Widget System

### How AI-Generated Widgets Work

1. User says "Create a widget that shows my Plex library sizes as a bar chart"
2. Agent receives the prompt + list of available data endpoints
3. Agent generates a self-contained HTML document with inline CSS and JS
4. The HTML uses `commandarr.fetch('/api/proxy/plex/libraries')` to get live data
5. Widget blob is stored in SQLite
6. On the dashboard, each widget renders inside a sandboxed `<iframe>` with `srcdoc`
7. The iframe has access to a `commandarr` API object injected via `postMessage` bridge

### Widget API (available inside widget iframes)

```javascript
// Injected into every widget iframe via postMessage bridge
const commandarr = {
  // Fetch data from any connected integration (proxied through Commandarr)
  fetch: async (path, options) => { /* proxied fetch */ },

  // Subscribe to real-time updates
  subscribe: (event, callback) => { /* WebSocket subscription */ },

  // Get integration status
  getStatus: async (integrationId) => { /* health status */ },

  // Widget metadata
  config: {
    refreshInterval: 30000,    // Auto-refresh interval (configurable)
    theme: 'dark',             // Current UI theme
  },

  // Trigger agent actions from within a widget
  executeCommand: async (prompt) => { /* sends to agent core */ },
};
```

### Pre-built Widgets (ship with v1)

1. **System Status** — Health dots for all integrations, uptime counters
2. **Now Playing** — Plex current streams with user, title, progress, transcode status
3. **Download Queue** — Combined Radarr + Sonarr queue with progress bars
4. **Recent Additions** — Poster grid of recently added media
5. **Calendar** — Upcoming releases from Radarr + Sonarr calendars
6. **Storage** — Disk usage bars for all configured library paths
7. **Agent Activity** — Recent conversations / tool executions timeline

---

## Automation System

### Schema

```typescript
interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;              // Cron expression
  prompt: string;                // What to tell the agent
  conditions?: {
    integration: string;         // Only run if this integration is...
    status: 'healthy' | 'unhealthy';
  };
  notification?: {
    platform: 'telegram' | 'discord' | 'none';
    chatId?: string;
  };
  lastRun?: Date;
  lastResult?: string;
  createdAt: Date;
}
```

### Example Automations

| Name | Schedule | Prompt |
|------|----------|--------|
| Plex Watchdog | `*/5 * * * *` | "Check if Plex is responding. If not, restart it and tell me what happened." |
| Trending Movies | `0 9 * * 1` | "Check what movies are trending this week on Radarr and add any with >7.5 rating." |
| Storage Alert | `0 */6 * * *` | "Check disk usage. If any drive is over 90%, tell me which one and what the biggest files are." |
| Weekly Digest | `0 8 * * 0` | "Give me a summary of what was added to Plex this week, what's downloading, and any issues." |

---

## Database Schema (Drizzle)

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const integrationCredentials = sqliteTable('integration_credentials', {
  id: text('id').primaryKey(),               // integration ID (e.g. 'plex')
  credentials: text('credentials'),           // JSON, encrypted at rest
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  lastHealthStatus: text('last_health_status'), // 'healthy' | 'unhealthy' | 'unknown'
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  platform: text('platform'),                 // 'web' | 'telegram' | 'discord'
  platformChatId: text('platform_chat_id'),
  messages: text('messages'),                  // JSON array of messages
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const automations = sqliteTable('automations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  schedule: text('schedule').notNull(),        // Cron expression
  prompt: text('prompt').notNull(),
  conditions: text('conditions'),              // JSON
  notification: text('notification'),          // JSON
  lastRun: integer('last_run', { mode: 'timestamp' }),
  lastResult: text('last_result'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const automationRuns = sqliteTable('automation_runs', {
  id: text('id').primaryKey(),
  automationId: text('automation_id').references(() => automations.id),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  result: text('result'),                      // Agent response
  toolCalls: text('tool_calls'),               // JSON array of tool executions
  status: text('status'),                      // 'success' | 'error'
});

export const widgets = sqliteTable('widgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  html: text('html').notNull(),                // The generated HTML/JS/CSS blob
  prompt: text('prompt'),                      // Original user prompt (for regeneration)
  position: text('position'),                  // JSON: { x, y, w, h } on dashboard grid
  refreshInterval: integer('refresh_interval').default(30000),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const llmProviders = sqliteTable('llm_providers', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),   // 'openrouter' | 'openai' | etc.
  config: text('config'),                      // JSON, encrypted
  model: text('model'),
  priority: integer('priority').default(0),     // Fallback order
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
});

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp', { mode: 'timestamp' }),
  source: text('source'),                      // 'agent' | 'automation' | 'user' | 'webhook'
  action: text('action'),                      // tool name or event type
  integration: text('integration'),
  input: text('input'),                        // JSON
  output: text('output'),                      // JSON
  level: text('level'),                        // 'info' | 'warn' | 'error'
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});
```

---

## API Routes

```
# Agent
POST   /api/chat                    # Send message, get streamed response
GET    /api/chat/history             # Conversation history
DELETE /api/chat/history/:id         # Delete conversation

# Integrations
GET    /api/integrations             # List all integrations + status
GET    /api/integrations/:id         # Get integration details
PUT    /api/integrations/:id/creds   # Save credentials
POST   /api/integrations/:id/test    # Test connection
GET    /api/integrations/:id/tools   # List tools for integration
POST   /api/integrations/:id/tools/:toolId/test  # Test individual tool

# Proxy (for widgets to access integration APIs)
ALL    /api/proxy/:integrationId/*   # Proxied request to integration

# Automations
GET    /api/automations              # List all
POST   /api/automations              # Create
PUT    /api/automations/:id          # Update
DELETE /api/automations/:id          # Delete
POST   /api/automations/:id/run      # Trigger manually
GET    /api/automations/:id/runs     # Run history

# Widgets
GET    /api/widgets                  # List all
POST   /api/widgets                  # Create (from AI prompt)
PUT    /api/widgets/:id              # Update
DELETE /api/widgets/:id              # Delete
POST   /api/widgets/generate         # Generate HTML from prompt (preview)

# LLM
GET    /api/llm/providers            # List configured providers
PUT    /api/llm/providers/:id        # Update provider config
POST   /api/llm/providers/:id/test   # Test provider
GET    /api/llm/providers/:id/models # List available models
PUT    /api/llm/fallback-order       # Update priority chain

# Settings
GET    /api/settings                 # All settings
PUT    /api/settings                 # Update settings

# WebSockets
WS     /ws/chat                      # Streaming agent responses
WS     /ws/logs                      # Real-time log stream
WS     /ws/widget/:id                # Live data for specific widget

# Webhooks (from external services)
POST   /webhooks/plex                # Plex server events
POST   /webhooks/radarr              # Radarr events
POST   /webhooks/sonarr              # Sonarr events
```

---

## Community Extension Guide

### Creating a New Integration

```bash
# 1. Copy the template
cp -r src/integrations/_template src/integrations/my-service

# 2. Edit manifest.ts with your service's credential schema
# 3. Build your API client in client.ts
# 4. Add tools in tools/ directory
# 5. Restart Commandarr — it auto-discovers the new integration
```

### Integration Developer Contract

Every integration MUST provide:
- `manifest.ts` — Exports `IntegrationManifest` with id, name, credential schema, health check config
- `client.ts` — Exports a factory function that takes credentials and returns a typed API client
- At least one tool in `tools/` — Exports `ToolDefinition` with name, description, parameters, handler

Every integration MAY provide:
- `webhooks.ts` — Exports webhook handlers for incoming events from the service
- `README.md` — Documentation shown in the UI's integration detail page
- Additional tools — Each file in `tools/` is auto-discovered

### Tool Developer Contract

```typescript
// Minimal tool definition
export const tool: ToolDefinition = {
  name: 'myservice_do_thing',        // Must be: {integration_id}_{action}
  integration: 'my-service',          // Must match manifest.id
  description: 'Clear description of what this tool does and when to use it.',
  parameters: {
    type: 'object',
    properties: {
      // JSON Schema for parameters
    },
    required: []
  },
  ui: {
    category: 'string',              // Grouping in the UI
    dangerLevel: 'low' | 'medium' | 'high',
    testable: boolean,
    testDefaults: {}                  // Default params for the "Test" button
  },
  handler: async (params, ctx) => {
    // ctx.getClient('my-service') returns your configured API client
    // Return { success: boolean, message: string, data?: any }
  }
};
```

---

## Project Structure

```
commandarr/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── bunfig.toml
├── drizzle.config.ts
├── src/
│   ├── index.ts                     # Entry point — Hono server, WebSocket, scheduler
│   ├── agent/
│   │   ├── core.ts                  # Agent loop: prompt → LLM → tool calls → response
│   │   ├── system-prompt.ts         # Dynamic system prompt builder
│   │   └── tool-executor.ts         # Dispatches tool calls to integration handlers
│   ├── llm/
│   │   ├── provider.ts              # Abstract interface
│   │   ├── providers/
│   │   │   ├── openrouter.ts
│   │   │   ├── openai.ts
│   │   │   ├── anthropic.ts
│   │   │   ├── google.ts
│   │   │   ├── lmstudio.ts
│   │   │   ├── ollama.ts
│   │   │   └── custom.ts
│   │   └── router.ts               # Provider selection + fallback
│   ├── integrations/
│   │   ├── _base.ts                 # Types + base classes
│   │   ├── registry.ts              # Auto-discovery + registration
│   │   ├── plex/
│   │   ├── radarr/
│   │   ├── sonarr/
│   │   └── _template/
│   ├── chat/
│   │   ├── adapter.ts               # Abstract chat platform interface
│   │   ├── telegram.ts              # grammy bot
│   │   ├── discord.ts               # discord.js bot (optional)
│   │   └── web.ts                   # WebSocket chat for web UI
│   ├── scheduler/
│   │   └── cron.ts                  # Automation scheduler
│   ├── widgets/
│   │   ├── generator.ts             # LLM-based widget generation
│   │   ├── sandbox.ts               # iframe bridge + API injection
│   │   └── prebuilt/                # Default widgets
│   ├── db/
│   │   ├── schema.ts                # Drizzle schema
│   │   ├── migrate.ts               # Auto-migration on startup
│   │   └── index.ts                 # DB connection
│   ├── routes/
│   │   ├── api.ts                   # All /api/* routes
│   │   ├── webhooks.ts              # All /webhooks/* routes
│   │   └── ws.ts                    # WebSocket handlers
│   └── utils/
│       ├── crypto.ts                # Credential encryption
│       ├── logger.ts                # Structured logging
│       └── config.ts                # Environment config
├── web/                              # Frontend (Vite + React)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                  # TanStack Router setup
│   │   ├── routes/                  # File-based routing
│   │   │   ├── index.tsx            # Dashboard
│   │   │   ├── chat.tsx
│   │   │   ├── integrations/
│   │   │   │   ├── index.tsx        # Integration grid
│   │   │   │   └── $id.tsx          # Integration detail (creds, tools, webhooks, docs)
│   │   │   ├── automations.tsx
│   │   │   ├── widgets.tsx
│   │   │   └── settings/
│   │   │       ├── llm.tsx
│   │   │       └── general.tsx
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components (generated)
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── chat/
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   └── ToolCallCard.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── WidgetGrid.tsx
│   │   │   │   └── WidgetFrame.tsx
│   │   │   └── integrations/
│   │   │       ├── CredentialForm.tsx   # Dynamic form from manifest schema
│   │   │       ├── ToolList.tsx
│   │   │       └── StatusBadge.tsx
│   │   ├── lib/
│   │   │   ├── api.ts               # TanStack Query hooks
│   │   │   └── ws.ts                # WebSocket client
│   │   └── styles/
│   │       └── globals.css          # Tailwind base + shadcn/ui theme
│   └── components.json              # shadcn/ui config
├── docs/
│   ├── getting-started.md
│   ├── creating-integrations.md
│   ├── creating-widgets.md
│   ├── llm-providers.md
│   └── api-reference.md
└── community-integrations/           # Separate dir for community PRs
    └── README.md                     # "How to contribute an integration"
```

---

## Docker Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  commandarr:
    image: ghcr.io/braedonsaunders/commandarr:latest
    container_name: commandarr
    restart: unless-stopped
    ports:
      - "8484:8484"
    volumes:
      - ./data:/app/data                     # SQLite + config persistence
      - ./integrations:/app/custom-integrations  # User-added integrations
    environment:
      - PORT=8484
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}       # For credential encryption
      # Optional: pre-configure via env vars
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
      # Plex restart capability (if running on same host)
      - PLEX_RESTART_COMMAND=docker restart plex
    # If Plex runs as a sibling container, give access to Docker socket
    # volumes:
    #   - /var/run/docker.sock:/var/run/docker.sock
```

---

## Build Plan

### Day 1 — Core Engine (Backend + Minimal UI)

**Morning (4h):**
1. `bun init` + monorepo structure (src/ + web/)
2. Drizzle schema + SQLite setup with auto-migration
3. Hono server with API route stubs
4. LLM provider abstraction + OpenRouter + OpenAI + Anthropic implementations
5. Agent core: system prompt builder + tool call loop

**Afternoon (4h):**
6. Integration base types + registry (auto-discovery)
7. Plex integration: manifest + client + health-check + restart + now-playing tools
8. Radarr integration: manifest + client + search + add + queue tools
9. Sonarr integration: manifest + client + search + add + queue tools
10. Telegram bot (grammy) wired to agent core

**Evening (3h):**
11. Vite + React + shadcn/ui scaffold
12. Sidebar layout + routing (TanStack Router)
13. Integrations page: credential forms (dynamic from manifest), test connection
14. Chat page: basic message UI + streaming responses

### Day 2 — Dashboard + Widgets + Polish

**Morning (4h):**
1. Dashboard page: widget grid with drag-and-drop
2. Widget generation: LLM prompt → HTML blob → iframe rendering
3. Pre-built widgets: System Status, Now Playing, Download Queue
4. Widget editor: CodeMirror + live preview

**Afternoon (4h):**
5. Automations page: CRUD + cron scheduler
6. LLM settings page: multi-provider config, fallback chain, model selector
7. Logs page: real-time WebSocket stream
8. Settings page: general config, Telegram setup, backup/restore

**Evening (3h):**
9. Dockerfile + docker-compose.yml
10. README with screenshots/GIFs, one-liner install
11. GitHub repo setup: license, contributing guide, integration template docs
12. Test full flow: Telegram → agent → Radarr add movie → notification

---

## Launch Strategy

### GitHub README Structure (critical for virality)

```markdown
# 🛰️ Commandarr

**The AI brain for your media stack.**

[Hero screenshot/GIF of Telegram interaction adding a movie]

One Docker command. Talk to your server. It talks back.

## Quick Start
docker compose up -d

## What Can It Do?
[3 GIFs side by side: Telegram chat, Dashboard widgets, Automation running]

## Supported Integrations
Plex · Radarr · Sonarr · [community contributions welcome]

## Build Your Own Integration
[Link to guide — "Add a new service in 15 minutes"]
```

### Subreddit Launch Plan
- **r/selfhosted** — "I built an AI agent that controls my entire media stack from Telegram"
- **r/PleX** — "Commandarr: chat with your Plex server, auto-restart when down, AI-generated dashboard widgets"
- **r/homelab** — "New *arr app: LLM-powered automation for your media stack"
- **r/radarr + r/sonarr** — "Add movies/shows from Telegram with natural language"

### Key Demo Scenarios (for GIFs)
1. Text "Add The Bear" on Telegram → Sonarr search → confirm → added
2. Widget creation: "Make me a widget showing Plex streams" → widget appears on dashboard
3. Automation: Plex goes down → Commandarr restarts it → Telegram notification
4. "What's downloading?" → combined Radarr + Sonarr queue summary
