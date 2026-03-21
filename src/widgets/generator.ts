import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { widgets } from '../db/schema';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';

export async function generateWidget(prompt: string, name?: string): Promise<{
  id: string;
  name: string;
  html: string;
  description: string;
}> {
  const { chatWithFallback } = await import('../llm/router');

  const systemPrompt = `You are a widget generator for Commandarr, a media server management dashboard.
Generate a self-contained HTML widget based on the user's description.

The widget will be rendered in an iframe on a dark-themed dashboard.

Rules:
- Output ONLY the complete HTML document, no explanation
- Use inline CSS and JavaScript (no external dependencies)
- Dark theme: background #1a1a2e, text #e0e0e0, accent #E5A00D
- Use the commandarr.fetch() API to get data from integrations
- Available API endpoints (proxied through Commandarr):
  - /api/proxy/plex/status/sessions - Current Plex streams
  - /api/proxy/plex/library/sections - Plex libraries
  - /api/proxy/radarr/api/v3/queue - Radarr download queue
  - /api/proxy/radarr/api/v3/calendar - Upcoming movies
  - /api/proxy/sonarr/api/v3/queue - Sonarr download queue
  - /api/proxy/sonarr/api/v3/calendar - Upcoming shows
  - /api/integrations - Integration status
- The widget has access to a global 'commandarr' object:
  - commandarr.fetch(path) - fetch data from API
  - commandarr.config.refreshInterval - auto-refresh interval
  - commandarr.config.theme - 'dark' or 'light'
- Use modern CSS (flexbox, grid, etc.)
- Include auto-refresh using setInterval
- Handle loading states and errors gracefully
- Make the widget responsive
- Use clean typography (system fonts)

Example structure:
<!DOCTYPE html>
<html>
<head><style>body { margin:0; padding:16px; background:#1a1a2e; color:#e0e0e0; font-family:system-ui; }</style></head>
<body>
<div id="widget"></div>
<script>
async function loadData() {
  try {
    const data = await commandarr.fetch('/api/proxy/plex/status/sessions');
    // render data
  } catch(e) {
    document.getElementById('widget').textContent = 'Error loading data';
  }
}
loadData();
setInterval(loadData, commandarr.config.refreshInterval || 30000);
</script>
</body>
</html>`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: prompt },
  ];

  let html = '';
  const stream = chatWithFallback(messages);
  for await (const chunk of stream) {
    if (chunk.type === 'text' && chunk.text) {
      html += chunk.text;
    }
  }

  // Extract HTML from response (in case LLM wraps it in markdown code blocks)
  const htmlMatch = html.match(/```html\n([\s\S]*?)\n```/);
  if (htmlMatch) {
    html = htmlMatch[1]!;
  } else if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    // Already raw HTML, use as-is
    const startIdx = html.indexOf('<!DOCTYPE');
    if (startIdx === -1) {
      const htmlStart = html.indexOf('<html');
      if (htmlStart !== -1) html = html.substring(htmlStart);
    } else {
      html = html.substring(startIdx);
    }
  }

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

export async function regenerateWidget(widgetId: string): Promise<string> {
  const db = await getDb();
  const [widget] = await db.select().from(widgets).where(eq(widgets.id, widgetId));
  if (!widget || !widget.prompt) throw new Error('Widget not found or has no prompt');

  const result = await generateWidget(widget.prompt, widget.name);

  await db.update(widgets).set({
    html: result.html,
    updatedAt: new Date(),
  }).where(eq(widgets.id, widgetId));

  return result.html;
}
