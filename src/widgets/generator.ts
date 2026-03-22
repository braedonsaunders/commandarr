import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { widgets } from '../db/schema';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

const WIDGET_SYSTEM_PROMPT = `You are a widget code generator for Commandarr, a media server dashboard.
You generate self-contained HTML widgets that run inside sandboxed iframes.

CRITICAL RULES:
1. Output ONLY a complete HTML document. No markdown, no explanation, no code fences.
2. Start your response with <!DOCTYPE html> and end with </html>.
3. All CSS must be inline in a <style> tag. All JS inline in a <script> tag.
4. No external dependencies, CDNs, or imports.

ENVIRONMENT:
- The widget renders in a sandboxed iframe on a dark dashboard.
- A global \`commandarr\` object is injected automatically. You do NOT need to define it.
- Use \`commandarr.fetch(url)\` to load data. It returns a Promise that resolves to parsed JSON.

AVAILABLE DATA ENDPOINTS:
  commandarr.fetch('/api/proxy/plex/status/sessions')
    → { MediaContainer: { Metadata: [{ title, grandparentTitle, User: {title}, Player: {title}, viewOffset, duration, TranscodeSession?, type }] } }

  commandarr.fetch('/api/proxy/plex/library/sections')
    → { MediaContainer: { Directory: [{ title, type, key }] } }

  commandarr.fetch('/api/proxy/plex/search?query=TERM')
    → { MediaContainer: { Metadata: [{ title, year, type, summary, rating }] } }

  commandarr.fetch('/api/proxy/radarr/api/v3/queue')
    → { records: [{ title, status, sizeleft, size, timeleft, movie: {title} }] }

  commandarr.fetch('/api/proxy/radarr/api/v3/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD')
    → [{ title, year, inCinemas, digitalRelease, physicalRelease, overview }]

  commandarr.fetch('/api/proxy/radarr/api/v3/movie')
    → [{ title, year, hasFile, sizeOnDisk, path }]

  commandarr.fetch('/api/proxy/sonarr/api/v3/queue')
    → { records: [{ title, status, sizeleft, size, timeleft, series: {title}, episode: {seasonNumber, episodeNumber, title} }] }

  commandarr.fetch('/api/proxy/sonarr/api/v3/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD')
    → [{ series: {title}, seasonNumber, episodeNumber, title, airDateUtc }]

  commandarr.fetch('/api/integrations')
    → [{ id, name, configured, healthy, status, toolCount }]

DESIGN REQUIREMENTS:
- Background: #1a1a2e (or transparent to inherit dashboard bg)
- Text: #e0e0e0, secondary text: #8b8ba0
- Accent color: #E5A00D (amber/gold)
- Plex color: #E5A00D, Radarr: #FFC230, Sonarr: #35C5F4
- Font: system-ui, -apple-system, sans-serif
- Use CSS grid or flexbox for layout
- Rounded corners (8-12px), subtle borders (#2a2a4a)
- Smooth transitions and hover effects
- Responsive (works at any widget size)

DATA LOADING PATTERN:
- Load data on page load immediately
- Set up auto-refresh with setInterval (every 10-30 seconds depending on data type)
- Show a loading skeleton/spinner on first load
- Handle errors gracefully (show "Unable to load" with retry)
- Handle empty states ("Nothing playing", "Queue empty", etc.)

QUALITY:
- Clean, polished, production-quality UI
- Progress bars for download queues
- Relative time formatting where appropriate
- Truncate long text with ellipsis
- Animate number changes if relevant`;

function extractHtml(raw: string): string {
  // Try markdown code fence first
  const fenceMatch = raw.match(/```(?:html)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) return fenceMatch[1]!.trim();

  // Find the HTML document
  const doctypeIdx = raw.indexOf('<!DOCTYPE');
  const htmlIdx = raw.indexOf('<html');
  const startIdx = doctypeIdx !== -1 ? doctypeIdx : htmlIdx;

  if (startIdx !== -1) {
    const endIdx = raw.lastIndexOf('</html>');
    if (endIdx !== -1) return raw.substring(startIdx, endIdx + 7);
    return raw.substring(startIdx);
  }

  // If no HTML structure found, wrap it
  return raw;
}

export async function generateWidget(prompt: string, name?: string): Promise<{
  id: string;
  name: string;
  html: string;
  description: string;
}> {
  const { chatWithFallback } = await import('../llm/router');

  const messages = [
    { role: 'system' as const, content: WIDGET_SYSTEM_PROMPT },
    { role: 'user' as const, content: prompt },
  ];

  let raw = '';
  const stream = chatWithFallback(messages);
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) raw += chunk.text;
    if (chunk.type === 'error') throw new Error(chunk.error || 'LLM error');
  }

  const html = extractHtml(raw);
  const widgetName = name || `Widget ${new Date().toLocaleDateString()}`;
  const id = nanoid();

  const db = await getDb();
  await db.insert(widgets).values({
    id,
    name: widgetName,
    description: prompt,
    html,
    prompt,
    position: JSON.stringify({ x: 0, y: 0, w: 4, h: 3 }),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  logger.info('widget', `Generated widget: ${widgetName}`);
  return { id, name: widgetName, html, description: prompt };
}

export async function updateWidget(widgetId: string, prompt: string): Promise<{
  id: string;
  name: string;
  html: string;
}> {
  const db = await getDb();
  const [widget] = await db.select().from(widgets).where(eq(widgets.id, widgetId));
  if (!widget) throw new Error('Widget not found');

  const { chatWithFallback } = await import('../llm/router');

  const messages = [
    { role: 'system' as const, content: WIDGET_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: `Here is the current widget HTML:\n\n${widget.html}\n\nUpdate it with this change: ${prompt}`,
    },
  ];

  let raw = '';
  const stream = chatWithFallback(messages);
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) raw += chunk.text;
    if (chunk.type === 'error') throw new Error(chunk.error || 'LLM error');
  }

  const html = extractHtml(raw);

  await db.update(widgets).set({
    html,
    prompt: `${widget.prompt || ''}\n\nUpdate: ${prompt}`,
    updatedAt: new Date(),
  }).where(eq(widgets.id, widgetId));

  logger.info('widget', `Updated widget: ${widget.name}`);
  return { id: widgetId, name: widget.name, html };
}

export async function listWidgets(): Promise<Array<{ id: string; name: string; description: string | null }>> {
  const db = await getDb();
  const all = await db.select({ id: widgets.id, name: widgets.name, description: widgets.description }).from(widgets);
  return all;
}
