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
import { existsSync } from 'node:fs';

const app = new Hono();

// Middleware
app.use('*', cors());

// Basic auth (if configured)
if (config.authEnabled) {
  // Skip auth for health check and webhooks
  app.use('*', async (c, next) => {
    const path = c.req.path;
    if (path === '/health' || path.startsWith('/webhooks/')) {
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

// Serve frontend static files
// Resolve the web/dist directory relative to the source file location
const distDir = join(import.meta.dir, '..', 'web', 'dist');

app.get('/*', async (c) => {
  const urlPath = new URL(c.req.url).pathname;

  // Try to serve the exact file
  const filePath = join(distDir, urlPath);
  const file = Bun.file(filePath);
  if (await file.exists()) {
    return new Response(file, {
      headers: { 'Content-Type': getMimeType(urlPath) },
    });
  }

  // SPA fallback — serve index.html for all non-file routes
  const indexPath = join(distDir, 'index.html');
  const indexFile = Bun.file(indexPath);
  if (await indexFile.exists()) {
    return new Response(indexFile, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return c.text('Dashboard not found. Run the frontend build first.', 404);
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
      // Handle WebSocket upgrades
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
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
}

start().catch((e) => {
  console.error('Failed to start Commandarr:', e);
  process.exit(1);
});
