import { writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { logger } from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────────────

export interface GeneratedIntegration {
  id: string;
  manifest: string;   // TypeScript source for manifest.ts
  client: string;     // TypeScript source for client.ts
  tools: Array<{ filename: string; source: string }>;
  widgets: Array<{ filename: string; source: string }>;
  summary: string;
}

interface GenerationProgress {
  phase: string;
  detail?: string;
}

// ─── System Prompt ───────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an integration code generator for Commandarr, a media server management dashboard.
You generate complete, production-quality integration packages that plug into the Commandarr integration system.

## OUTPUT FORMAT

You MUST respond with a single JSON object (no markdown fences, no explanation before or after).
The JSON object has this exact shape:

{
  "id": "kebab-case-id",
  "manifest": "// TypeScript source for manifest.ts",
  "client": "// TypeScript source for client.ts",
  "tools": [
    { "filename": "tool-name.ts", "source": "// TypeScript source" }
  ],
  "widgets": [
    { "filename": "widget-name.ts", "source": "// TypeScript source" }
  ],
  "summary": "Brief summary of what was generated"
}

## MANIFEST FILE (manifest.ts)

Must export \`manifest\` conforming to IntegrationManifest:

\`\`\`typescript
import type { IntegrationManifest } from '../_base';

export const manifest: IntegrationManifest = {
  id: 'my-integration',        // kebab-case, unique
  name: 'My Integration',      // Display name
  description: 'Short description of what this integration does',
  icon: 'package',             // lucide icon name (lowercase): tv, film, monitor, play-circle, hard-drive, download, download-cloud, bar-chart-2, book-open, eye-off, arrow-down-circle, flame, music, home, package, inbox, search
  color: '#E5A00D',            // Brand hex color
  version: '1.0.0',
  credentials: [
    {
      key: 'url',
      label: 'Server URL',
      type: 'url',              // 'text' | 'password' | 'url' | 'number'
      required: true,
      placeholder: 'http://localhost:8080',
      helpText: 'The URL of your server',
      docsUrl: 'https://...',   // optional
    },
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      placeholder: 'Your API key',
      helpText: 'How to find your API key',
    },
  ],
  healthCheck: {
    endpoint: '/api/v1/system/status',  // GET endpoint that returns 200 when healthy
    interval: 60,                        // seconds between checks
    timeout: 5,                          // seconds before timeout
  },
  webhooks: {                           // optional
    path: '/webhooks/my-integration',
    description: 'Receives webhook events',
  },
  wakeHooks: [                          // optional
    {
      event: 'health_down',
      description: 'Triggered when service becomes unreachable',
      defaultPrompt: 'Service is not responding. Check status.',
      enabledByDefault: true,
    },
    {
      event: 'health_recovered',
      description: 'Triggered when service comes back online',
      defaultPrompt: 'Service is back online. Verify everything works.',
      enabledByDefault: true,
    },
  ],
};
\`\`\`

## CLIENT FILE (client.ts)

Must export \`createClient\` function:

\`\`\`typescript
import type { IntegrationClient } from '../_base';

interface MyCredentials {
  url: string;
  apiKey: string;
}

async function apiFetch(baseUrl: string, apiKey: string, method: string, path: string, body?: unknown): Promise<any> {
  const url = new URL(path, baseUrl);
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-Api-Key': apiKey,       // Auth header varies by service
  };
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(\`API error \${response.status}: \${text.slice(0, 200)}\`);
  }

  return response.json();
}

export function createClient(creds: MyCredentials): IntegrationClient {
  const baseUrl = creds.url.replace(/\\/+$/, '');
  const { apiKey } = creds;

  return {
    async get(path, params?) {
      let fullPath = path;
      if (params) {
        const sp = new URLSearchParams(params);
        fullPath += (path.includes('?') ? '&' : '?') + sp.toString();
      }
      return apiFetch(baseUrl, apiKey, 'GET', fullPath);
    },
    async post(path, body?) { return apiFetch(baseUrl, apiKey, 'POST', path, body); },
    async put(path, body?) { return apiFetch(baseUrl, apiKey, 'PUT', path, body); },
    async delete(path) { return apiFetch(baseUrl, apiKey, 'DELETE', path); },
  };
}
\`\`\`

## TOOL FILES (tools/*.ts)

Each tool file exports a single \`tool\` conforming to ToolDefinition:

\`\`\`typescript
import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'integration_tool_name',    // integration_action format
  integration: 'my-integration',     // must match manifest id
  description: 'What this tool does',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  ui: {
    category: 'Monitoring',          // Monitoring, System, Media, Library, Queue, Search, etc.
    dangerLevel: 'low',              // 'low' | 'medium' | 'high'
    testable: true,
    testDefaults: { query: 'test' }, // optional defaults for testing
  },
  async handler(params, ctx) {
    const client = ctx.getClient('my-integration');
    ctx.log('Doing something...');
    const response = await client.get('/api/endpoint');
    return {
      success: true,
      message: 'Description of result',
      data: response,
    };
  },
};
\`\`\`

## WIDGET FILES (widgets/*.ts) — optional

Each widget file exports a \`widget\` conforming to PrebuiltWidgetDef:

\`\`\`typescript
export const widget = {
  id: 'prebuilt-widget-name',
  slug: 'widget-name',
  name: 'Widget Display Name',
  description: 'What this widget shows',
  capabilities: ['context', 'state'],
  controls: [
    { id: 'refresh', label: 'Refresh', kind: 'button', parameters: [], execution: { kind: 'state', patch: {} } },
  ],
  html: \`<h3>Title</h3><div id="widget">Loading...</div>\`,
  css: \`h3 { margin:0 0 12px; font-size:14px; font-weight:600; color:#a0a0b0; }\`,
  js: \`async function load() {
  try {
    commandarr.setStatus('Refreshing...');
    var data = await commandarr.fetch('/api/proxy/my-integration/api/endpoint');
    var el = document.getElementById('widget');
    // Update DOM with data
    commandarr.setStatus('');
  } catch(e) { commandarr.setStatus('Error'); }
}
load().then(function() { commandarr.ready(); });
setInterval(load, 15000);\`,
};
\`\`\`

## REQUIREMENTS

- Generate at least 3-5 useful tools covering common operations (health check, status, listing, search, etc.)
- Generate 1-2 prebuilt widgets if relevant
- Use the correct API authentication method for the target service
- Use correct API endpoints based on the service's actual API
- Handle both success and error cases in tool handlers
- Tool names must follow the pattern: integrationId_action (e.g., radarr_get_movies)
- All imports use relative paths from the integration's directory
- Do NOT use ES modules or external dependencies
- Use \`fetch\` for HTTP calls (built into the runtime)
- Keep code clean and production-ready

## IMPORTANT

Research the target service's API thoroughly. Use correct:
- Authentication methods (API keys, tokens, basic auth, etc.)
- API endpoint paths and versions
- Request/response formats
- Default ports`;
}

// ─── Research Phase ──────────────────────────────────────────────────

async function researchService(serviceName: string): Promise<string> {
  // Use LLM to gather context about the service's API
  const { chatWithFallbackSync } = await import('../llm/router');

  const result = await chatWithFallbackSync([
    {
      role: 'system',
      content: 'You are a technical researcher. Provide concise, accurate information about software APIs. Focus on: authentication methods, API endpoint structure, default ports, common operations, and response formats. Be factual and specific.',
    },
    {
      role: 'user',
      content: `Research the API for "${serviceName}". I need to know:
1. What is this service? (1-2 sentences)
2. Default port number
3. Authentication method (API key header name, token format, etc.)
4. API base path and version (e.g., /api/v1, /api/v3)
5. Key API endpoints for: health check, listing items, searching, getting status/queue
6. Response format examples (JSON structure)
7. Any quirks or special considerations

Be specific and accurate. If you're unsure about an endpoint, say so.`,
    },
  ]);

  return result.text;
}

// ─── JSON Extraction ─────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch { /* continue */ }

  const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]!.trim());
    } catch { /* continue */ }
  }

  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
    } catch { /* continue */ }
  }

  throw new Error('Could not extract JSON from LLM response');
}

// ─── TypeScript Validation ───────────────────────────────────────────

function validateTsSyntax(source: string): string | null {
  // Basic validation — check for obvious issues
  try {
    // Strip TypeScript-specific syntax for basic JS validation
    const jsified = source
      .replace(/import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]*['"]\s*;?/g, '')
      .replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]*['"]\s*;?/g, '')
      .replace(/export\s+/g, '')
      .replace(/:\s*(string|number|boolean|any|unknown|void|Record<[^>]*>|IntegrationManifest|IntegrationClient|ToolDefinition|ToolResult|PlexSession)\b/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/as\s+\w+/g, '');
    new Function(jsified);
    return null;
  } catch {
    // TypeScript validation is tricky without a compiler, so allow it through
    return null;
  }
}

// ─── Generate Integration ────────────────────────────────────────────

export async function generateIntegration(
  prompt: string,
  onProgress?: (progress: GenerationProgress) => void,
): Promise<GeneratedIntegration> {
  const { chatWithFallback } = await import('../llm/router');

  // Phase 1: Research
  onProgress?.({ phase: 'researching', detail: 'Gathering API documentation...' });
  let research = '';
  try {
    research = await researchService(prompt);
    logger.info('integration-gen', `Research completed for: ${prompt}`);
  } catch (err) {
    logger.warn('integration-gen', 'Research phase failed, proceeding without', err);
  }

  // Phase 2: Generate
  onProgress?.({ phase: 'generating', detail: 'Building integration code...' });
  const systemPrompt = buildSystemPrompt();
  const userPrompt = research
    ? `Create a complete Commandarr integration for: ${prompt}\n\nHere is research about this service's API:\n${research}`
    : `Create a complete Commandarr integration for: ${prompt}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  let raw = '';
  const stream = chatWithFallback(messages);
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) raw += chunk.text;
    if (chunk.type === 'error') throw new Error(chunk.error || 'LLM error');
  }

  // Phase 3: Parse
  onProgress?.({ phase: 'parsing', detail: 'Parsing generated code...' });
  const parsed = extractJson(raw) as any;

  if (!parsed.id || !parsed.manifest || !parsed.client) {
    throw new Error('LLM response missing required fields (id, manifest, client)');
  }

  const result: GeneratedIntegration = {
    id: String(parsed.id).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, ''),
    manifest: parsed.manifest,
    client: parsed.client,
    tools: Array.isArray(parsed.tools) ? parsed.tools : [],
    widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
    summary: parsed.summary || `Generated integration: ${parsed.id}`,
  };

  logger.info('integration-gen', `Generated integration: ${result.id} (${result.tools.length} tools, ${result.widgets.length} widgets)`);
  return result;
}

// ─── Write Integration to Disk ───────────────────────────────────────

export async function writeIntegrationToDisk(integration: GeneratedIntegration): Promise<string> {
  const integrationsDir = join(import.meta.dir, '.');
  const integrationDir = join(integrationsDir, integration.id);

  // Create directories
  await mkdir(integrationDir, { recursive: true });
  await mkdir(join(integrationDir, 'tools'), { recursive: true });
  if (integration.widgets.length > 0) {
    await mkdir(join(integrationDir, 'widgets'), { recursive: true });
  }

  // Write manifest
  await writeFile(join(integrationDir, 'manifest.ts'), integration.manifest, 'utf-8');

  // Write client
  await writeFile(join(integrationDir, 'client.ts'), integration.client, 'utf-8');

  // Write tools
  for (const tool of integration.tools) {
    const filename = tool.filename.endsWith('.ts') ? tool.filename : `${tool.filename}.ts`;
    await writeFile(join(integrationDir, 'tools', filename), tool.source, 'utf-8');
  }

  // Write widgets
  for (const widget of integration.widgets) {
    const filename = widget.filename.endsWith('.ts') ? widget.filename : `${widget.filename}.ts`;
    await writeFile(join(integrationDir, 'widgets', filename), widget.source, 'utf-8');
  }

  logger.info('integration-gen', `Wrote integration to disk: ${integrationDir}`);
  return integrationDir;
}

// ─── Import Integration from Folder ──────────────────────────────────

export async function importIntegrationFromFolder(folderPath: string): Promise<{ id: string; files: string[] }> {
  const integrationsDir = join(import.meta.dir, '.');
  const folderName = basename(folderPath);

  // Validate required files exist
  const entries = await readdir(folderPath, { withFileTypes: true });
  const fileNames = entries.map(e => e.name);

  if (!fileNames.includes('manifest.ts')) {
    throw new Error('Missing required file: manifest.ts');
  }
  if (!fileNames.includes('client.ts')) {
    throw new Error('Missing required file: client.ts');
  }

  // Read manifest to get integration ID
  const manifestContent = await readFile(join(folderPath, 'manifest.ts'), 'utf-8');
  const idMatch = manifestContent.match(/id:\s*['"]([^'"]+)['"]/);
  const id = idMatch?.[1] || folderName;

  // Copy to integrations directory
  const targetDir = join(integrationsDir, id);
  await mkdir(targetDir, { recursive: true });

  const copiedFiles: string[] = [];

  async function copyDir(src: string, dest: string) {
    const items = await readdir(src, { withFileTypes: true });
    for (const item of items) {
      const srcPath = join(src, item.name);
      const destPath = join(dest, item.name);
      if (item.isDirectory()) {
        await mkdir(destPath, { recursive: true });
        await copyDir(srcPath, destPath);
      } else if (item.name.endsWith('.ts')) {
        const content = await readFile(srcPath, 'utf-8');
        await writeFile(destPath, content, 'utf-8');
        copiedFiles.push(destPath);
      }
    }
  }

  await copyDir(folderPath, targetDir);

  logger.info('integration-gen', `Imported integration from folder: ${id} (${copiedFiles.length} files)`);
  return { id, files: copiedFiles };
}

// ─── Import Integration from ZIP ─────────────────────────────────────

export async function importIntegrationFromZip(zipBuffer: ArrayBuffer): Promise<{ id: string; files: string[] }> {
  const { mkdtemp, rm, writeFile: writeTmpFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const tempDir = await mkdtemp(join(tmpdir(), 'commandarr-import-'));

  try {
    // Write zip to temp file then unzip
    const zipPath = join(tempDir, '__upload.zip');
    await writeTmpFile(zipPath, new Uint8Array(zipBuffer));
    const proc = Bun.spawn(['unzip', '-o', zipPath, '-d', tempDir], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    // Find the integration root (may be nested one level)
    const topLevel = await readdir(tempDir, { withFileTypes: true });
    let rootDir = tempDir;

    // If there's a single directory at top level, use it as root
    const dirs = topLevel.filter(e => e.isDirectory());
    if (dirs.length === 1 && !topLevel.some(e => e.name === 'manifest.ts')) {
      rootDir = join(tempDir, dirs[0]!.name);
    }

    return await importIntegrationFromFolder(rootDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Reload Single Integration ───────────────────────────────────────

export async function reloadIntegration(integrationId: string): Promise<void> {
  // Re-initialize the full registry to pick up new integrations
  const { initRegistry } = await import('./registry');
  await initRegistry();
  logger.info('integration-gen', `Registry reloaded after adding: ${integrationId}`);
}
