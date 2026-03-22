import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { widgets, widgetState } from '../db/schema';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';
import { GeneratedWidgetSchema } from './types';
import type { WidgetRecord } from './types';

// ─── System Prompt ───────────────────────────────────────────────────

function buildSystemPrompt(integrationEndpoints: string): string {
  return `You are a widget code generator for Commandarr, a media server management dashboard.
You generate self-contained, production-quality dashboard widgets.

## OUTPUT FORMAT

You MUST respond with a single JSON object (no markdown fences, no explanation before or after).
The JSON object has this exact shape:

{
  "name": "Short Widget Name (2-80 chars)",
  "description": "One-line description of what this widget shows (1-96 chars)",
  "capabilities": ["context"],
  "controls": [],
  "html": "<div id=\\"widget\\">...</div>",
  "css": "body { ... }",
  "js": "async function load() { ... }",
  "summary": "Brief summary of what was built and why (1-320 chars)"
}

## FIELD RULES

### capabilities (array of 1-3 values)
- "context" — widget reads data (almost all widgets need this)
- "state" — widget persists user preferences across reloads
- "integration-control" — widget sends commands (POST/PUT/DELETE) to integrations

### controls (array, max 40)
Each control enables the host dashboard to expose structured actions:
{
  "id": "unique-kebab-id",
  "label": "Button Label",
  "description": "What this does",
  "kind": "button" | "toggle" | "select" | "form",
  "parameters": [
    {
      "key": "paramName",
      "label": "Param Label",
      "type": "string" | "number" | "boolean" | "enum",
      "required": true,
      "defaultValue": "...",
      "options": [{ "label": "...", "value": "..." }]
    }
  ],
  "execution": {
    "kind": "operation",
    "operation": {
      "protocol": "http",
      "integrationId": "plex",
      "method": "POST",
      "path": "/api/v3/command",
      "body": { "name": "{{paramName}}" }
    }
  }
  OR
  "execution": {
    "kind": "state",
    "patch": { "view": "compact" },
    "mergeStrategy": "deep-merge"
  },
  "confirmation": "Are you sure?",
  "successMessage": "Done!",
  "danger": false
}

A refresh control should always be: { id: "refresh", label: "Refresh", kind: "button", parameters: [], execution: { kind: "state", patch: {} } }

### html (max 24KB)
- Pure HTML markup. No <script> or <style> tags — those go in js/css fields.
- No <html>, <head>, <body>, or <!DOCTYPE> tags — the runtime wraps your content.
- Use semantic elements: <div>, <span>, <table>, <ul>, etc.
- Images: both http: and https: URLs are allowed. Data URIs also work.
- For images from local services (Radarr, Sonarr, Plex, etc), proxy through commandarr.fetch or use direct URLs.

### css (max 24KB)
- Pure CSS rules. No <style> tags.
- Base styles are automatically applied (dark theme, system font).
- Your CSS is injected in a <style> block.

### js (max 48KB)
- Pure JavaScript. No <script> tags.
- Your code runs after DOMContentLoaded automatically.
- No ES modules, no import/export, no external dependencies.
- Use var instead of const/let for maximum compatibility.
- When building HTML strings, use single quotes for HTML attributes to avoid JSON escaping issues.
  Example: '<div class=\\'item\\'>' instead of '<div class="item">'
  Or use template approach: '<div class="item">' is fine in the js field as long as you don't nest it in another string.

## RUNTIME API — window.commandarr

The widget runtime injects a global \`commandarr\` object:

### commandarr.fetch(url, options?)
Make HTTP requests through the Commandarr proxy. Returns a Promise resolving to parsed JSON.
- url: API path like '/api/proxy/plex/status/sessions'
- options: optional { method, headers, body } — defaults to GET

### commandarr.getState()
Returns a Promise resolving to the widget's persisted state object.
Use this on startup to restore user preferences.

### commandarr.setState(state)
Persists a state object server-side. Returns a Promise.
The state survives page reloads and browser restarts.

### commandarr.invokeControl(controlId, input?)
Executes a declared control. Returns a Promise with the result.
Only works for controls listed in the controls array.

### commandarr.setStatus(text)
Sets a status text displayed in the widget's title bar.
Useful for showing "Loading...", "Updated 5s ago", error states, etc.

### commandarr.ready()
MUST be called when the widget has finished initial setup.
The dashboard shows a loading spinner until ready() is called.
Call it after your first data load completes (even if data is empty).

### commandarr.config
- commandarr.config.refreshInterval — default polling interval (15000ms)
- commandarr.config.theme — 'dark'
- commandarr.config.widgetId — this widget's unique ID
- commandarr.config.capabilities — array of this widget's capabilities

## DATA LOADING PATTERN

\`\`\`js
var state = {};

async function load() {
  try {
    commandarr.setStatus('Refreshing...');
    var data = await commandarr.fetch('/api/proxy/plex/status/sessions');
    // Update DOM with data
    commandarr.setStatus('');
  } catch(e) {
    commandarr.setStatus('Error: ' + e.message);
  }
}

// Restore persisted state, then load
commandarr.getState().then(function(s) {
  state = s || {};
  // Apply state to UI (e.g., selected tab, filters)
  load().then(function() { commandarr.ready(); });
});

setInterval(load, commandarr.config.refreshInterval);
\`\`\`

## AVAILABLE DATA ENDPOINTS
${integrationEndpoints}

## DESIGN REQUIREMENTS

Base styles are automatically applied, but you should follow these guidelines:
- Background: transparent (inherits from dashboard) or #1a1a2e
- Text: #e0e0e0, secondary: #8b8ba0
- Accent: #E5A00D (amber/gold)
- Brand colors: Plex #E5A00D, Radarr #FFC230, Sonarr #35C5F4, Jellyfin #00A4DC
- Font: system-ui, -apple-system, sans-serif (auto-applied)
- Rounded corners: 8-12px, subtle borders: #2a2a4a
- Smooth transitions and hover effects
- Responsive — widget may render at any size
- Show loading state before data arrives
- Handle empty states gracefully
- Handle errors gracefully with retry indication
- Progress bars for queue/download items
- Truncate long text with ellipsis

## IMPORTANT RULES — FOLLOW EXACTLY
- Do NOT use ES modules (import/export) — the JS runs as a plain script
- Do NOT reference external CDNs or script libraries
- Images from local network services (http://) ARE allowed
- Do NOT use arrow functions — use function() {} everywhere for compatibility
- Do NOT use const or let — use var for all variable declarations
- Do NOT include <script>, <style>, <html>, <head>, <body>, or <!DOCTYPE> tags in any field
- Always call commandarr.ready() after initial setup
- Always include a "refresh" control for data-fetching widgets
- When building HTML strings in JS, prefer single quotes for attributes or use string concatenation
- Handle all errors gracefully with try/catch — never let the widget crash silently
- Test your logic mentally — make sure loops, conditionals, and string building are correct`;
}

// ─── Integration Endpoint Discovery ──────────────────────────────────

async function buildIntegrationEndpoints(): Promise<string> {
  try {
    const { getIntegrations } = await import('../integrations/registry');
    const integrations = getIntegrations();

    const configured = integrations.filter((i) => i.status !== 'unconfigured');
    if (configured.length === 0) {
      return `No integrations are currently configured. Use commandarr.fetch('/api/integrations') to check available integrations.`;
    }

    const endpointDocs: string[] = [];

    for (const integration of configured) {
      const id = integration.id;
      const name = integration.manifest.name;
      const healthy = integration.status === 'healthy';

      endpointDocs.push(`### ${name} (${id}) — ${healthy ? 'healthy' : 'unhealthy'}`);
      endpointDocs.push(`Base: commandarr.fetch('/api/proxy/${id}/...')`);

      // Add known endpoints per integration type
      switch (id) {
        case 'plex':
          endpointDocs.push(`  /api/proxy/plex/status/sessions → { MediaContainer: { Metadata: [{ title, grandparentTitle, User: {title}, Player: {title}, viewOffset, duration, TranscodeSession?, type }] } }`);
          endpointDocs.push(`  /api/proxy/plex/library/sections → { MediaContainer: { Directory: [{ title, type, key }] } }`);
          endpointDocs.push(`  /api/proxy/plex/search?query=TERM → { MediaContainer: { Metadata: [...] } }`);
          break;
        case 'radarr':
          endpointDocs.push(`  /api/proxy/radarr/api/v3/queue → { records: [{ title, status, sizeleft, size, timeleft, movie: {title} }] }`);
          endpointDocs.push(`  /api/proxy/radarr/api/v3/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD → [{ title, year, inCinemas, digitalRelease, overview }]`);
          endpointDocs.push(`  /api/proxy/radarr/api/v3/movie → [{ title, year, hasFile, sizeOnDisk }]`);
          endpointDocs.push(`  /api/proxy/radarr/api/v3/system/status → { version, ... }`);
          break;
        case 'sonarr':
          endpointDocs.push(`  /api/proxy/sonarr/api/v3/queue → { records: [{ title, status, sizeleft, size, timeleft, series: {title}, episode: {seasonNumber, episodeNumber, title} }] }`);
          endpointDocs.push(`  /api/proxy/sonarr/api/v3/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD → [{ series: {title}, seasonNumber, episodeNumber, title, airDateUtc }]`);
          endpointDocs.push(`  /api/proxy/sonarr/api/v3/series → [{ title, seasons, episodeFileCount, episodeCount }]`);
          break;
        case 'jellyfin':
          endpointDocs.push(`  /api/proxy/jellyfin/Sessions → [{ UserName, Client, DeviceName, NowPlayingItem?, PlayState? }]`);
          endpointDocs.push(`  /api/proxy/jellyfin/Library/MediaFolders → { Items: [{ Name, CollectionType, Id }] }`);
          break;
        case 'emby':
          endpointDocs.push(`  /api/proxy/emby/Sessions → [{ UserName, Client, DeviceName, NowPlayingItem?, PlayState? }]`);
          break;
        case 'sabnzbd':
          endpointDocs.push(`  /api/proxy/sabnzbd/api?mode=queue&output=json → { queue: { slots: [{ filename, status, percentage, timeleft, mb, mbleft }] } }`);
          endpointDocs.push(`  /api/proxy/sabnzbd/api?mode=history&output=json → { history: { slots: [...] } }`);
          break;
        case 'qbittorrent':
          endpointDocs.push(`  /api/proxy/qbittorrent/api/v2/torrents/info → [{ name, state, progress, dlspeed, upspeed, size, eta }]`);
          endpointDocs.push(`  /api/proxy/qbittorrent/api/v2/transfer/info → { dl_info_speed, up_info_speed, ... }`);
          break;
        case 'transmission':
          endpointDocs.push(`  /api/proxy/transmission/transmission/rpc (POST with method: "torrent-get") → { arguments: { torrents: [...] } }`);
          break;
        case 'deluge':
          endpointDocs.push(`  /api/proxy/deluge/json (POST RPC) → { result: ... }`);
          break;
        case 'tautulli':
          endpointDocs.push(`  /api/proxy/tautulli/api/v2?cmd=get_activity → { response: { data: { sessions: [...] } } }`);
          endpointDocs.push(`  /api/proxy/tautulli/api/v2?cmd=get_history → { response: { data: { data: [...] } } }`);
          break;
        case 'prowlarr':
          endpointDocs.push(`  /api/proxy/prowlarr/api/v1/indexer → [{ id, name, enable, protocol }]`);
          endpointDocs.push(`  /api/proxy/prowlarr/api/v1/indexerstats → [{ ... }]`);
          break;
        case 'bazarr':
          endpointDocs.push(`  /api/proxy/bazarr/api/system/status → { ... }`);
          endpointDocs.push(`  /api/proxy/bazarr/api/episodes/wanted → { data: [...] }`);
          break;
        case 'seerr':
          endpointDocs.push(`  /api/proxy/seerr/api/v1/request?take=20 → { results: [{ type, media: {tmdbId, status}, requestedBy: {displayName} }] }`);
          endpointDocs.push(`  /api/proxy/seerr/api/v1/request/count → { total, movie, tv, pending, approved, ... }`);
          break;
        case 'lidarr':
          endpointDocs.push(`  /api/proxy/lidarr/api/v1/queue → { records: [...] }`);
          endpointDocs.push(`  /api/proxy/lidarr/api/v1/artist → [{ artistName, ... }]`);
          break;
        case 'readarr':
          endpointDocs.push(`  /api/proxy/readarr/api/v1/queue → { records: [...] }`);
          endpointDocs.push(`  /api/proxy/readarr/api/v1/book → [{ title, ... }]`);
          break;
        case 'homeassistant':
          endpointDocs.push(`  /api/proxy/homeassistant/api/states → [{ entity_id, state, attributes, last_changed }]`);
          endpointDocs.push(`  /api/proxy/homeassistant/api/ → { message: "API running." }`);
          break;
        default:
          endpointDocs.push(`  Use the integration's REST API through /api/proxy/${id}/...`);
          break;
      }
      endpointDocs.push('');
    }

    endpointDocs.push(`### General`);
    endpointDocs.push(`  commandarr.fetch('/api/integrations') → [{ id, name, configured, healthy, status, toolCount }]`);

    return endpointDocs.join('\n');
  } catch {
    return `Use commandarr.fetch('/api/integrations') to discover available integrations, then use /api/proxy/{integrationId}/... to access their APIs.`;
  }
}

// ─── Field Sanitization ──────────────────────────────────────────────

/**
 * Sanitize HTML field from LLM output.
 * Strips any <script>, <style>, <html>, <head>, <body> tags the LLM may have included
 * since those are provided by the runtime wrapper.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim();
}

/**
 * Sanitize CSS field — strip <style> tag wrappers if the LLM included them.
 */
function sanitizeCss(css: string): string {
  return css
    .replace(/<\/?style[^>]*>/gi, '')
    .trim();
}

/**
 * Sanitize JS field — strip <script> tag wrappers if the LLM included them.
 */
function sanitizeJs(js: string): string {
  return js
    .replace(/<\/?script[^>]*>/gi, '')
    .trim();
}

// ─── JSON Extraction ─────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  // Try raw JSON parse first
  try {
    return JSON.parse(raw);
  } catch { /* continue */ }

  // Try markdown code fence
  const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]!.trim());
    } catch { /* continue */ }
  }

  // Try to find JSON object boundaries
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
    } catch { /* continue */ }
  }

  throw new Error('Could not extract JSON from LLM response');
}

// ─── Legacy HTML Extraction (for backward compat) ────────────────────

function extractHtml(raw: string): string {
  const fenceMatch = raw.match(/```(?:html)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) return fenceMatch[1]!.trim();

  const doctypeIdx = raw.indexOf('<!DOCTYPE');
  const htmlIdx = raw.indexOf('<html');
  const startIdx = doctypeIdx !== -1 ? doctypeIdx : htmlIdx;

  if (startIdx !== -1) {
    const endIdx = raw.lastIndexOf('</html>');
    if (endIdx !== -1) return raw.substring(startIdx, endIdx + 7);
    return raw.substring(startIdx);
  }

  return raw;
}

// ─── Validation ──────────────────────────────────────────────────────

function validateJsSyntax(js: string): string | null {
  try {
    // Use Function constructor to check syntax (does not execute)
    new Function(js);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid JavaScript';
  }
}

// ─── Generate Widget ─────────────────────────────────────────────────

export async function generateWidget(prompt: string, name?: string): Promise<{
  id: string;
  name: string;
  html: string;
  css: string;
  js: string;
  description: string;
  capabilities: string[];
  controls: unknown[];
  slug: string;
  revision: number;
}> {
  const { chatWithFallback } = await import('../llm/router');
  const integrationEndpoints = await buildIntegrationEndpoints();
  const systemPrompt = buildSystemPrompt(integrationEndpoints);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: prompt },
  ];

  // Phase 1: Generate
  let raw = '';
  const stream = chatWithFallback(messages);
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) raw += chunk.text;
    if (chunk.type === 'error') throw new Error(chunk.error || 'LLM error');
  }

  // Phase 2: Parse — try structured JSON first, fall back to HTML extraction
  let widgetData: {
    name: string;
    description: string;
    capabilities: string[];
    controls: unknown[];
    html: string;
    css: string;
    js: string;
    summary: string;
  };

  try {
    const parsed = extractJson(raw);
    const validated = GeneratedWidgetSchema.parse(parsed);
    validated.html = sanitizeHtml(validated.html);
    validated.css = sanitizeCss(validated.css);
    validated.js = sanitizeJs(validated.js);
    widgetData = validated;
  } catch (jsonError) {
    // Fall back to HTML extraction for backward compatibility
    logger.warn('widget', 'Failed to parse structured JSON, falling back to HTML extraction', {
      error: jsonError instanceof Error ? jsonError.message : String(jsonError),
    });

    const html = extractHtml(raw);
    widgetData = {
      name: name || `Widget ${new Date().toLocaleDateString()}`,
      description: prompt.substring(0, 96),
      capabilities: ['context'],
      controls: [{ id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } }],
      html,
      css: '',
      js: '',
      summary: prompt.substring(0, 320),
    };
  }

  // Phase 3: Validate JS syntax if separate
  if (widgetData.js) {
    const jsError = validateJsSyntax(widgetData.js);
    if (jsError) {
      // Try to repair
      logger.warn('widget', `JS syntax error: ${jsError}, attempting repair`);
      const repaired = await repairJs(widgetData.js, jsError);
      if (repaired) {
        widgetData.js = repaired;
      } else {
        logger.warn('widget', 'JS repair failed, keeping original');
      }
    }
  }

  // Phase 4: Store
  const widgetName = name || widgetData.name;
  const id = nanoid();
  const slug = widgetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const db = await getDb();
  await db.insert(widgets).values({
    id,
    slug,
    name: widgetName,
    description: widgetData.description,
    status: 'active',
    html: widgetData.html,
    css: widgetData.css,
    js: widgetData.js,
    capabilities: JSON.stringify(widgetData.capabilities),
    controls: JSON.stringify(widgetData.controls),
    prompt,
    position: JSON.stringify({ x: 0, y: 0, w: 6, h: 2 }),
    revision: 1,
    createdBy: 'commandarr',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Initialize runtime state
  await db.insert(widgetState).values({
    widgetId: id,
    stateJson: '{}',
    updatedAt: new Date(),
  });

  logger.info('widget', `Generated widget: ${widgetName} (${id})`);

  return {
    id,
    name: widgetName,
    html: widgetData.html,
    css: widgetData.css,
    js: widgetData.js,
    description: widgetData.description,
    capabilities: widgetData.capabilities,
    controls: widgetData.controls,
    slug,
    revision: 1,
  };
}

// ─── JS Repair ───────────────────────────────────────────────────────

async function repairJs(js: string, error: string): Promise<string | null> {
  try {
    const { chatWithFallback } = await import('../llm/router');

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a JavaScript syntax fixer. You receive broken JavaScript and a syntax error. Return ONLY the fixed JavaScript code, nothing else. No markdown fences, no explanation.',
      },
      {
        role: 'user' as const,
        content: `Fix this JavaScript syntax error:\n\nError: ${error}\n\nCode:\n${js}`,
      },
    ];

    let repaired = '';
    const stream = chatWithFallback(messages);
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) repaired += chunk.text;
    }

    // Strip markdown fences if present
    const fenceMatch = repaired.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
    if (fenceMatch) repaired = fenceMatch[1]!.trim();

    const checkError = validateJsSyntax(repaired);
    if (checkError) return null;

    return repaired;
  } catch {
    return null;
  }
}

// ─── Update Widget (regenerate) ──────────────────────────────────────

export async function updateWidget(widgetId: string, prompt: string): Promise<{
  id: string;
  name: string;
  html: string;
  css: string;
  js: string;
}> {
  const db = await getDb();
  const [widget] = await db.select().from(widgets).where(eq(widgets.id, widgetId));
  if (!widget) throw new Error('Widget not found');

  const { chatWithFallback } = await import('../llm/router');
  const integrationEndpoints = await buildIntegrationEndpoints();
  const systemPrompt = buildSystemPrompt(integrationEndpoints);

  const existingContext = widget.js
    ? `Current widget JS:\n${widget.js}\n\nCurrent widget HTML:\n${widget.html}\n\nCurrent widget CSS:\n${widget.css}`
    : `Current widget HTML:\n${widget.html}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    {
      role: 'user' as const,
      content: `${existingContext}\n\nUpdate this widget with the following change: ${prompt}`,
    },
  ];

  let raw = '';
  const stream = chatWithFallback(messages);
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) raw += chunk.text;
    if (chunk.type === 'error') throw new Error(chunk.error || 'LLM error');
  }

  let html: string, css: string, js: string;
  let controls: unknown[] | undefined;
  let capabilities: string[] | undefined;

  try {
    const parsed = extractJson(raw);
    const validated = GeneratedWidgetSchema.parse(parsed);
    html = sanitizeHtml(validated.html);
    css = sanitizeCss(validated.css);
    js = sanitizeJs(validated.js);
    controls = validated.controls;
    capabilities = validated.capabilities;
  } catch {
    html = extractHtml(raw);
    css = '';
    js = '';
  }

  const newRevision = (widget.revision ?? 1) + 1;

  const updateData: Record<string, unknown> = {
    html,
    css,
    js,
    revision: newRevision,
    prompt: `${widget.prompt || ''}\n\nUpdate: ${prompt}`,
    updatedAt: new Date(),
  };

  if (controls) updateData.controls = JSON.stringify(controls);
  if (capabilities) updateData.capabilities = JSON.stringify(capabilities);

  await db.update(widgets).set(updateData).where(eq(widgets.id, widgetId));

  logger.info('widget', `Updated widget: ${widget.name} (rev ${newRevision})`);
  return { id: widgetId, name: widget.name, html, css, js };
}

export async function listWidgets(): Promise<Array<{ id: string; name: string; description: string | null }>> {
  const db = await getDb();
  const all = await db.select({ id: widgets.id, name: widgets.name, description: widgets.description }).from(widgets);
  return all;
}
