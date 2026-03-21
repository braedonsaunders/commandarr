import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { initDb } from './db/index';
import { api } from './routes/api';
import { webhooks } from './routes/webhooks';
import { handleWSUpgrade, wsHandlers, initLogBroadcast } from './routes/ws';

const app = new Hono();

// Middleware
app.use('*', cors());

// API routes
app.route('/api', api);

// Webhook routes
app.route('/webhooks', webhooks);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve frontend static files
app.use('/*', serveStatic({ root: './web/dist' }));
app.get('*', serveStatic({ path: './web/dist/index.html' }));

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

  logger.info('server', `Commandarr running on http://localhost:${server.port}`);
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   🛰️  Commandarr is running!              ║
  ║                                           ║
  ║   Dashboard: http://localhost:${String(server.port).padEnd(5)}      ║
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
}

start().catch((e) => {
  console.error('Failed to start Commandarr:', e);
  process.exit(1);
});
