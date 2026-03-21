import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { auditLog } from '../db/schema';
import { logger } from '../utils/logger';

export const webhooks = new Hono();

webhooks.post('/plex', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    let payload: Record<string, unknown>;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const payloadStr = formData.get('payload');
      payload = payloadStr ? JSON.parse(payloadStr.toString()) : {};
    } else {
      payload = await c.req.json();
    }

    logger.info('webhook', `Plex webhook received: ${payload.event || 'unknown'}`, {
      event: payload.event,
      user: (payload.Account as Record<string, unknown>)?.title,
    });

    const db = await getDb();
    await db.insert(auditLog).values({
      id: nanoid(),
      timestamp: new Date(),
      source: 'webhook',
      action: `plex.${payload.event || 'unknown'}`,
      integration: 'plex',
      input: JSON.stringify(payload),
      level: 'info',
    });

    return c.json({ success: true });
  } catch (e) {
    logger.error('webhook', 'Plex webhook error', e);
    return c.json({ success: false }, 500);
  }
});

webhooks.post('/radarr', async (c) => {
  try {
    const payload = await c.req.json();
    const eventType = payload.eventType || 'unknown';

    logger.info('webhook', `Radarr webhook received: ${eventType}`, {
      event: eventType,
      movie: payload.movie?.title,
    });

    const db = await getDb();
    await db.insert(auditLog).values({
      id: nanoid(),
      timestamp: new Date(),
      source: 'webhook',
      action: `radarr.${eventType}`,
      integration: 'radarr',
      input: JSON.stringify(payload),
      level: 'info',
    });

    return c.json({ success: true });
  } catch (e) {
    logger.error('webhook', 'Radarr webhook error', e);
    return c.json({ success: false }, 500);
  }
});

webhooks.post('/sonarr', async (c) => {
  try {
    const payload = await c.req.json();
    const eventType = payload.eventType || 'unknown';

    logger.info('webhook', `Sonarr webhook received: ${eventType}`, {
      event: eventType,
      series: payload.series?.title,
    });

    const db = await getDb();
    await db.insert(auditLog).values({
      id: nanoid(),
      timestamp: new Date(),
      source: 'webhook',
      action: `sonarr.${eventType}`,
      integration: 'sonarr',
      input: JSON.stringify(payload),
      level: 'info',
    });

    return c.json({ success: true });
  } catch (e) {
    logger.error('webhook', 'Sonarr webhook error', e);
    return c.json({ success: false }, 500);
  }
});
