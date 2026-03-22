import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { basicAuth } from 'hono/basic-auth';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { initDb } from './db/index';
import { api } from './routes/api';
import { webhooks } from './routes/webhooks';
import { handleWSUpgrade, wsHandlers, initLogBroadcast } from './routes/ws';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';

const app = new Hono();

// Middleware
app.use('*', cors());

// Basic auth (if configured)
if (config.authEnabled) {
  app.use('*', async (c, next) => {
    const path = c.req.path;
    if (path === '/health' || path.startsWith('/webhooks/') || path === '/debug/static') {
      return next();
    }
    const auth = basicAuth({
      username: config.authUsername,
      password: config.authPassword,
    });
    return auth(c, next);
  });
  logger.info('server', 'Basic authentication enabled');
}

// API routes
app.route('/api', api);

// Webhook routes
app.route('/webhooks', webhooks);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Find frontend dist directory
function findDistDir(): string {
  const candidates = [
    join(import.meta.dir, '..', 'web', 'dist'),
    join(process.cwd(), 'web', 'dist'),
    '/app/web/dist',
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) {
      return dir;
    }
  }
  return '';
}

const distDir = findDistDir();

// Debug endpoint
app.get('/debug/static', (c) => {
  let distFiles: string[] = [];
  try {
    if (distDir) distFiles = readdirSync(distDir);
  } catch {}
  return c.json({
    distDir,
    distFound: !!distDir,
    distFiles,
    importMetaDir: import.meta.dir,
    cwd: process.cwd(),
  });
});

// Static file serving + SPA fallback
app.get('/*', async (c) => {
  if (!distDir) {
    return c.html(`
      <html><body style="background:#0a0a1a;color:#e0e0e0;font-family:system-ui;padding:40px;text-align:center">
        <h1>🛰️ Commandarr</h1>
        <p>Server is running but the dashboard files were not found.</p>
        <p style="color:#888">Visit <a href="/debug/static" style="color:#E5A00D">/debug/static</a> for details.</p>
        <p style="color:#888">API is available at <a href="/api/integrations" style="color:#E5A00D">/api/integrations</a></p>
      </body></html>
    `, 200);
  }

  const urlPath = new URL(c.req.url).pathname;

  // Try to serve the exact file (skip directory-like paths)
  if (urlPath !== '/' && !urlPath.endsWith('/')) {
    const filePath = join(distDir, urlPath);
    if (existsSync(filePath)) {
      return new Response(Bun.file(filePath), {
        headers: { 'Content-Type': getMimeType(urlPath) },
      });
    }
  }

  // SPA fallback — serve index.html
  return new Response(Bun.file(join(distDir, 'index.html')), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

function getMimeType(path: string): string {
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  return 'application/octet-stream';
}

// Initialize and start
async function start() {
  logger.info('server', 'Starting Commandarr...');

  // Log static file status
  if (distDir) {
    logger.info('server', `Frontend found at: ${distDir}`);
  } else {
    logger.warn('server', 'Frontend dist not found! Dashboard will show fallback page.');
  }

  // Initialize database
  await initDb();
  logger.info('server', 'Database initialized');

  // Initialize log broadcast for WebSocket
  initLogBroadcast();

  // Initialize integration registry
  try {
    const { initRegistry } = await import('./integrations/registry');
    await initRegistry();
    logger.info('server', 'Integration registry initialized');
  } catch (e) {
    logger.warn('server', 'Integration registry init failed (will retry on first use)', e);
  }

  // Initialize LLM providers
  try {
    const { initProviders } = await import('./llm/router');
    await initProviders();
    logger.info('server', 'LLM providers initialized');
  } catch (e) {
    logger.warn('server', 'LLM provider init failed (configure in settings)', e);
  }

  // Initialize scheduler
  try {
    const { initScheduler } = await import('./scheduler/cron');
    await initScheduler();
    logger.info('server', 'Scheduler initialized');
  } catch (e) {
    logger.warn('server', 'Scheduler init failed', e);
  }

  // Initialize wake hooks (health monitors + event triggers)
  try {
    const { initWakeHooks } = await import('./scheduler/wake-hooks');
    await initWakeHooks();
    logger.info('server', 'Wake hooks initialized');
  } catch (e) {
    logger.warn('server', 'Wake hooks init failed', e);
  }

  // Start Telegram bot if configured
  if (config.telegramBotToken) {
    try {
      const { TelegramAdapter } = await import('./chat/telegram');
      const telegram = new TelegramAdapter();
      await telegram.start();
    } catch (e) {
      logger.warn('server', 'Telegram bot failed to start', e);
    }
  }

  // Start the server
  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/ws/')) {
        if (handleWSUpgrade(req, server)) {
          return undefined;
        }
      }
      return app.fetch(req, { ip: server.requestIP(req) });
    },
    websocket: wsHandlers,
  });

  logger.info('server', `Commandarr running on http://${config.host}:${server.port}`);
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   🛰️  Commandarr is running!              ║
  ║                                           ║
  ║   Dashboard: http://localhost:${String(server.port).padEnd(5)}      ║
  ║   Host:      ${config.host.padEnd(28)}║
  ║   Auth:      ${(config.authEnabled ? 'enabled' : 'disabled').padEnd(28)}║
  ║   Frontend:  ${(distDir ? 'found' : 'NOT FOUND').padEnd(28)}║
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
}

start().catch((e) => {
  console.error('Failed to start Commandarr:', e);
  process.exit(1);
});
