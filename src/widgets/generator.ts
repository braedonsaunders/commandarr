import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { widgets, widgetState } from '../db/schema';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';
import { GeneratedWidgetSchema } from './types';
import type { WidgetRecord } from './types';
import type { ToolDef } from '../llm/provider';

// ─── Constants ────────────────────────────────────────────────────────
const WIDGET_MAX_OUTPUT_TOKENS = 16384;
const WIDGET_TEMPERATURE = 0.15;

// ─── Tool Definition ─────────────────────────────────────────────────

/**
 * The create_widget tool definition — this is the structured output format
 * that the LLM will call with proper JSON arguments, eliminating all
 * JSON extraction / parsing issues.
 */
const CREATE_WIDGET_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'create_widget',
    description: 'Create a dashboard widget with HTML, CSS, and JavaScript. Call this tool with the complete widget definition.',
    parameters: {
      type: 'object',
      required: ['name', 'description', 'capabilities', 'controls', 'html', 'css', 'js', 'summary'],
      properties: {
        name: {
          type: 'string',
          description: 'Short widget name (2-80 chars)',
        },
        description: {
          type: 'string',
          description: 'One-line description of what this widget shows (1-96 chars)',
        },
        capabilities: {
          type: 'array',
          items: { type: 'string', enum: ['context', 'state', 'integration-control'] },
          description: 'Widget capabilities: context (reads data), state (persists preferences), integration-control (sends commands)',
        },
        controls: {
          type: 'array',
          description: 'Widget controls for structured dashboard actions',
          items: {
            type: 'object',
            required: ['id', 'label', 'kind', 'parameters', 'execution'],
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              description: { type: 'string' },
              kind: { type: 'string', enum: ['button', 'toggle', 'select', 'form'] },
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['key', 'label', 'type'],
                  properties: {
                    key: { type: 'string' },
                    label: { type: 'string' },
                    type: { type: 'string', enum: ['string', 'number', 'boolean', 'enum'] },
                    required: { type: 'boolean' },
                    defaultValue: {},
                    options: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          label: { type: 'string' },
                          value: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
              execution: {
                type: 'object',
                required: ['kind'],
                properties: {
                  kind: { type: 'string', enum: ['operation', 'state'] },
                  operation: {
                    type: 'object',
                    properties: {
                      protocol: { type: 'string' },
                      integrationId: { type: 'string' },
                      method: { type: 'string' },
                      path: { type: 'string' },
                      body: {},
                    },
                  },
                  patch: { type: 'object' },
                  mergeStrategy: { type: 'string', enum: ['deep-merge', 'replace'] },
                },
              },
              confirmation: { type: 'string' },
              successMessage: { type: 'string' },
              danger: { type: 'boolean' },
            },
          },
        },
        html: {
          type: 'string',
          description: 'Pure HTML markup for the widget body. No <script>, <style>, <html>, <head>, <body>, or <!DOCTYPE> tags.',
        },
        css: {
          type: 'string',
          description: 'Pure CSS rules. No <style> tags.',
        },
        js: {
          type: 'string',
          description: 'Pure JavaScript code. No <script> tags. Use var, not const/let. Use function(), not arrows.',
        },
        summary: {
          type: 'string',
          description: 'Brief summary of what was built (1-320 chars)',
        },
      },
    },
  },
};

// ─── System Prompt ───────────────────────────────────────────────────

function buildSystemPrompt(integrationEndpoints: string): string {
  return `You are a world-class widget code generator for Commandarr, a media server management dashboard.
You generate self-contained, production-quality, visually stunning dashboard widgets.

You MUST call the create_widget tool with the complete widget definition. Do not output JSON directly — use the tool.

## FIELD RULES

### capabilities (array of 1-3 values)
- "context" — widget reads data (almost all widgets need this)
- "state" — widget persists user preferences across reloads
- "integration-control" — widget sends commands (POST/PUT/DELETE) to integrations

### controls (array, max 40)
Each control enables the host dashboard to expose structured actions.
A refresh control should always be: { id: "refresh", label: "Refresh", kind: "button", parameters: [], execution: { kind: "state", patch: {} } }

### html (max 24KB)
- Pure HTML markup. No <script> or <style> tags — those go in js/css fields.
- No <html>, <head>, <body>, or <!DOCTYPE> tags — the runtime wraps your content.
- Images: both http: and https: URLs are allowed. Data URIs also work.

### css (max 24KB)
- Pure CSS rules. No <style> tags.
- Base styles are automatically applied (dark theme, system font).
- USE CSS TO ITS FULL POTENTIAL — gradients, animations, transforms, backdrop-filter, box-shadow, transitions, keyframes.

### js (max 48KB)
- Pure JavaScript. No <script> tags.
- Your code runs automatically after the page loads.
- No ES modules, no import/export, no external dependencies.
- Use var instead of const/let for maximum compatibility.
- Use function() {} instead of arrow functions for compatibility.
- When building HTML strings, use single quotes for HTML attributes: '<div class=\\'item\\'>'

## RUNTIME API — window.commandarr

### commandarr.fetch(url, options?)
Make HTTP requests through the Commandarr proxy. Returns a Promise resolving to parsed JSON.
- url: API path like '/api/proxy/plex/status/sessions'
- options: optional { method, headers, body } — defaults to GET

### commandarr.getState() / commandarr.setState(state)
Persisted state that survives page reloads and browser restarts.

### commandarr.invokeControl(controlId, input?)
Executes a declared control. Returns a Promise with the result.

### commandarr.setStatus(text)
Sets a status text displayed in the widget's title bar.

### commandarr.ready()
MUST be called when the widget has finished initial setup.
The dashboard shows a loading spinner until ready() is called.

### commandarr.config
- commandarr.config.refreshInterval — default polling interval (15000ms)
- commandarr.config.theme — 'dark'
- commandarr.config.widgetId — unique widget ID
- commandarr.config.capabilities — array of capabilities

## DATA LOADING PATTERN

\`\`\`js
var state = {};
async function load() {
  try {
    commandarr.setStatus('Refreshing...');
    var data = await commandarr.fetch('/api/proxy/plex/status/sessions');
    commandarr.setStatus('');
  } catch(e) {
    commandarr.setStatus('Error: ' + e.message);
  }
}
commandarr.getState().then(function(s) {
  state = s || {};
  load().then(function() { commandarr.ready(); });
});
setInterval(load, commandarr.config.refreshInterval);
\`\`\`

## AVAILABLE DATA ENDPOINTS
${integrationEndpoints}

## VISUAL DESIGN REQUIREMENTS — THIS IS CRITICAL

Every widget must look like it belongs in a high-end commercial application.

### Color Palette
- Background: transparent or dark surfaces #0f0f1a, #1a1a2e, #16162a
- Cards/panels: #1c1c32, #22223a with subtle borders #2a2a4a
- Text primary: #f0f0f0, secondary: #a0a0c0, muted: #6a6a8a
- Accent: #E5A00D (amber/gold)
- Brand colors: Plex #E5A00D, Radarr #FFC230, Sonarr #35C5F4, Jellyfin #00A4DC
- Success: #50c878, Warning: #FFC230, Error: #ef4444, Info: #35C5F4

### Visual Effects
- Glassmorphism: background: rgba(30, 30, 60, 0.6); backdrop-filter: blur(12px);
- Subtle box-shadows: box-shadow: 0 4px 24px rgba(0,0,0,0.3);
- Glow effects for status: box-shadow: 0 0 12px rgba(80,200,120,0.3);
- Smooth transitions: transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
- Hover effects that elevate: transform: translateY(-2px);
- CSS animations for spinners, progress bars
- Gradient text for headers: background: linear-gradient(135deg, #E5A00D, #FFC230); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
- Rounded corners: 8-12px for cards, 4-6px for badges

### Professional Quality
- Every surface: border, shadow, or background — no floating text
- Cards: rounded corners + padding
- Lists: row separators
- Images: border-radius, object-fit, fallback placeholders
- Numbers: formatted with commas, units, relative time
- Loading state with styled spinner — never blank
- Handle empty/error states with styled cards
- Use emoji sparingly — prefer CSS shapes

## IMPORTANT RULES
- No ES modules, no external CDNs
- Images from http:// local services ARE allowed
- No arrow functions — use function() {} everywhere
- No const/let — use var
- No <script>, <style>, <html>, <head>, <body>, <!DOCTYPE> in any field
- Always call commandarr.ready() after initial setup
- Always include a "refresh" control for data-fetching widgets
- Handle errors with try/catch
- The widget MUST look visually impressive`;
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

      switch (id) {
        case 'plex':
          endpointDocs.push(`  /api/proxy/plex/status/sessions → { MediaContainer: { Metadata: [...] } }`);
          endpointDocs.push(`  /api/proxy/plex/library/sections → { MediaContainer: { Directory: [...] } }`);
          break;
        case 'radarr':
          endpointDocs.push(`  /api/proxy/radarr/api/v3/queue → { records: [...] }`);
          endpointDocs.push(`  /api/proxy/radarr/api/v3/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD → [{ title, year, inCinemas, digitalRelease, physicalRelease, overview, hasFile, images: [{coverType, remoteUrl}] }]`);
          endpointDocs.push(`  /api/proxy/radarr/api/v3/movie → [{ title, year, hasFile, sizeOnDisk, images }]`);
          endpointDocs.push(`  /api/proxy/radarr/api/v3/system/status → { version, ... }`);
          endpointDocs.push(`  For posters: use images array, find coverType='poster', use remoteUrl (TMDB https URL)`);
          break;
        case 'sonarr':
          endpointDocs.push(`  /api/proxy/sonarr/api/v3/queue → { records: [...] }`);
          endpointDocs.push(`  /api/proxy/sonarr/api/v3/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD → [{ series: {title, images}, seasonNumber, episodeNumber, title, airDateUtc, hasFile }]`);
          endpointDocs.push(`  /api/proxy/sonarr/api/v3/series → [{ title, seasons, episodeFileCount, episodeCount, images }]`);
          break;
        case 'jellyfin':
          endpointDocs.push(`  /api/proxy/jellyfin/Sessions → [{ UserName, Client, NowPlayingItem?, PlayState? }]`);
          break;
        case 'sabnzbd':
          endpointDocs.push(`  /api/proxy/sabnzbd/api?mode=queue&output=json → { queue: { slots: [...], speed, timeleft } }`);
          break;
        case 'qbittorrent':
          endpointDocs.push(`  /api/proxy/qbittorrent/api/v2/torrents/info → [{ name, state, progress, dlspeed, size, eta }]`);
          break;
        case 'tautulli':
          endpointDocs.push(`  /api/proxy/tautulli/api/v2?cmd=get_activity → { response: { data: { sessions: [...] } } }`);
          break;
        case 'prowlarr':
          endpointDocs.push(`  /api/proxy/prowlarr/api/v1/indexer → [{ id, name, enable, protocol }]`);
          break;
        case 'bazarr':
          endpointDocs.push(`  /api/proxy/bazarr/api/system/status → { ... }`);
          break;
        case 'seerr':
          endpointDocs.push(`  /api/proxy/seerr/api/v1/request?take=20 → { results: [...] }`);
          break;
        case 'lidarr':
          endpointDocs.push(`  /api/proxy/lidarr/api/v1/queue → { records: [...] }`);
          break;
        case 'readarr':
          endpointDocs.push(`  /api/proxy/readarr/api/v1/queue → { records: [...] }`);
          break;
        case 'homeassistant':
          endpointDocs.push(`  /api/proxy/homeassistant/api/states → [{ entity_id, state, attributes }]`);
          break;
        default:
          endpointDocs.push(`  Use /api/proxy/${id}/... for this integration's API`);
          break;
      }
      endpointDocs.push('');
    }

    endpointDocs.push(`### General`);
    endpointDocs.push(`  commandarr.fetch('/api/integrations') → [{ id, name, configured, healthy, status, toolCount }]`);

    return endpointDocs.join('\n');
  } catch {
    return `Use commandarr.fetch('/api/integrations') to discover available integrations.`;
  }
}

// ─── Field Sanitization ──────────────────────────────────────────────

function repairEscapedContent(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\'/g, "'");
}

function sanitizeHtml(html: string): string {
  return repairEscapedContent(
    html
      .replace(/<!doctype[^>]*>/gi, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<\/?head[^>]*>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .trim()
  );
}

function sanitizeCss(css: string): string {
  return repairEscapedContent(
    css.replace(/<\/?style[^>]*>/gi, '').trim()
  );
}

function sanitizeJs(js: string): string {
  return js.replace(/<\/?script[^>]*>/gi, '').trim();
}

// ─── Validation ──────────────────────────────────────────────────────

function validateJsSyntax(js: string): string | null {
  try {
    new Function(js);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid JavaScript';
  }
}

// ─── Generate Widget (via Tool Call) ─────────────────────────────────

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

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  const chatOptions = {
    temperature: WIDGET_TEMPERATURE,
    maxTokens: WIDGET_MAX_OUTPUT_TOKENS,
  };

  // Use the create_widget tool — the LLM returns structured JSON via tool calling
  let toolCallArgs: string | null = null;
  let textFallback = '';

  const stream = chatWithFallback(messages, [CREATE_WIDGET_TOOL], chatOptions);
  for await (const chunk of stream) {
    if (chunk.type === 'tool_call' && chunk.toolCall?.function.name === 'create_widget') {
      toolCallArgs = chunk.toolCall.function.arguments;
    }
    if (chunk.type === 'text' && chunk.text) textFallback += chunk.text;
    if (chunk.type === 'error') throw new Error(chunk.error || 'LLM error');
  }

  // Parse widget data — prefer tool call, fall back to text extraction
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

  if (toolCallArgs) {
    // Tool call path — the API already parsed the JSON for us
    logger.info('widget', 'Widget generated via tool call (structured output)');
    try {
      const parsed = JSON.parse(toolCallArgs);
      const validated = GeneratedWidgetSchema.parse(parsed);
      validated.html = sanitizeHtml(validated.html);
      validated.css = sanitizeCss(validated.css);
      validated.js = sanitizeJs(validated.js);
      widgetData = validated;
    } catch (e) {
      logger.warn('widget', 'Tool call args failed validation, trying raw parse', {
        error: e instanceof Error ? e.message : String(e),
      });
      // Try parsing the raw tool call args without strict validation
      const parsed = JSON.parse(toolCallArgs);
      widgetData = {
        name: parsed.name || name || 'Widget',
        description: parsed.description || prompt.substring(0, 96),
        capabilities: parsed.capabilities || ['context'],
        controls: parsed.controls || [{ id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } }],
        html: sanitizeHtml(parsed.html || ''),
        css: sanitizeCss(parsed.css || ''),
        js: sanitizeJs(parsed.js || ''),
        summary: parsed.summary || '',
      };
    }
  } else if (textFallback) {
    // Text fallback — some providers don't support tool calling
    logger.warn('widget', 'No tool call received, falling back to text extraction');
    widgetData = extractFromText(textFallback, prompt, name);
  } else {
    throw new Error('LLM returned no tool call and no text');
  }

  // Validate JS syntax
  if (widgetData.js) {
    const jsError = validateJsSyntax(widgetData.js);
    if (jsError) {
      logger.warn('widget', `JS syntax error: ${jsError}, attempting repair`);
      const repaired = await repairJs(widgetData.js, jsError);
      if (repaired) widgetData.js = repaired;
    }
  }

  // Store
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

// ─── Text Fallback Extraction ────────────────────────────────────────

function extractFromText(raw: string, prompt: string, name?: string): {
  name: string;
  description: string;
  capabilities: string[];
  controls: unknown[];
  html: string;
  css: string;
  js: string;
  summary: string;
} {
  // Try JSON extraction from text as fallback
  try {
    const parsed = findAndParseJson(raw);
    if (parsed && typeof parsed === 'object' && ('html' in parsed || 'js' in parsed)) {
      const validated = GeneratedWidgetSchema.parse(parsed);
      validated.html = sanitizeHtml(validated.html);
      validated.css = sanitizeCss(validated.css);
      validated.js = sanitizeJs(validated.js);
      return validated;
    }
  } catch { /* continue */ }

  // Last resort — should rarely happen
  logger.warn('widget', 'Could not extract widget from text, creating empty widget');
  return {
    name: name || `Widget ${new Date().toLocaleDateString()}`,
    description: prompt.substring(0, 96),
    capabilities: ['context'],
    controls: [{ id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } }],
    html: '<div style="padding:24px;text-align:center;color:#6a6a8a;">Widget generation failed. Please try again.</div>',
    css: '',
    js: 'commandarr.ready();',
    summary: 'Generation failed — placeholder widget',
  };
}

function findAndParseJson(raw: string): unknown {
  // Try raw parse
  try { return JSON.parse(raw); } catch { /* continue */ }

  // Try code fences
  const fenceRegex = /```(?:json)?\s*\n([\s\S]*?)\n```/g;
  let match;
  while ((match = fenceRegex.exec(raw)) !== null) {
    try { return JSON.parse(match[1]!.trim()); } catch { /* continue */ }
  }

  // Try balanced brace matching
  let pos = 0;
  while (pos < raw.length) {
    const idx = raw.indexOf('{', pos);
    if (idx === -1) break;
    const balanced = findBalancedJson(raw, idx);
    if (balanced && balanced.length > 100) {
      try { return JSON.parse(balanced); } catch { /* continue */ }
    }
    pos = idx + 1;
  }

  throw new Error('No JSON found');
}

function findBalancedJson(text: string, startIdx: number): string | null {
  if (text[startIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.substring(startIdx, i + 1);
    }
  }
  return null;
}

// ─── JS Repair ───────────────────────────────────────────────────────

async function repairJs(js: string, error: string): Promise<string | null> {
  try {
    const { chatWithFallback } = await import('../llm/router');

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      {
        role: 'system',
        content: 'You are a JavaScript syntax fixer. Return ONLY the fixed JavaScript code, nothing else. No markdown fences, no explanation.',
      },
      {
        role: 'user',
        content: `Fix this JavaScript syntax error:\n\nError: ${error}\n\nCode:\n${js}`,
      },
    ];

    let repaired = '';
    const stream = chatWithFallback(messages, undefined, { temperature: 0, maxTokens: WIDGET_MAX_OUTPUT_TOKENS });
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) repaired += chunk.text;
    }

    const fenceMatch = repaired.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/);
    if (fenceMatch) repaired = fenceMatch[1]!.trim();

    if (validateJsSyntax(repaired)) return null;
    return repaired;
  } catch {
    return null;
  }
}

// ─── Update Widget (via Tool Call) ──────────────────────────────────

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

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `${existingContext}\n\nUpdate this widget with the following change: ${prompt}`,
    },
  ];

  const chatOptions = {
    temperature: WIDGET_TEMPERATURE,
    maxTokens: WIDGET_MAX_OUTPUT_TOKENS,
  };

  let toolCallArgs: string | null = null;
  let textFallback = '';

  const stream = chatWithFallback(messages, [CREATE_WIDGET_TOOL], chatOptions);
  for await (const chunk of stream) {
    if (chunk.type === 'tool_call' && chunk.toolCall?.function.name === 'create_widget') {
      toolCallArgs = chunk.toolCall.function.arguments;
    }
    if (chunk.type === 'text' && chunk.text) textFallback += chunk.text;
    if (chunk.type === 'error') throw new Error(chunk.error || 'LLM error');
  }

  let html: string, css: string, js: string;
  let controls: unknown[] | undefined;
  let capabilities: string[] | undefined;

  if (toolCallArgs) {
    const parsed = JSON.parse(toolCallArgs);
    html = sanitizeHtml(parsed.html || '');
    css = sanitizeCss(parsed.css || '');
    js = sanitizeJs(parsed.js || '');
    controls = parsed.controls;
    capabilities = parsed.capabilities;
  } else if (textFallback) {
    try {
      const parsed = findAndParseJson(textFallback);
      if (parsed && typeof parsed === 'object') {
        const p = parsed as any;
        html = sanitizeHtml(p.html || '');
        css = sanitizeCss(p.css || '');
        js = sanitizeJs(p.js || '');
        controls = p.controls;
        capabilities = p.capabilities;
      } else {
        throw new Error('Invalid');
      }
    } catch {
      html = '<div style="padding:24px;text-align:center;color:#6a6a8a;">Update failed. Please try again.</div>';
      css = '';
      js = 'commandarr.ready();';
    }
  } else {
    throw new Error('LLM returned no tool call and no text');
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
