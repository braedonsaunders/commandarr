import { Cron } from 'croner';
import { logger } from '../utils/logger';
import type { WakeHook } from '../integrations/_base';

interface ActiveHook {
  integrationId: string;
  event: string;
  prompt: string;
  enabled: boolean;
}

interface HealthMonitor {
  integrationId: string;
  cron: Cron;
  lastStatus: 'healthy' | 'unhealthy' | 'unknown';
}

const activeHooks = new Map<string, ActiveHook>();
const healthMonitors = new Map<string, HealthMonitor>();

/**
 * Initialize wake hooks for all integrations.
 * This sets up:
 * 1. Health polling monitors that fire wake hooks when status changes
 * 2. Custom event listeners for webhook-triggered wake hooks
 */
export async function initWakeHooks() {
  const { getIntegrations, healthCheck } = await import('../integrations/registry');
  const { getDb } = await import('../db/index');
  const { settings } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');

  const integrations = getIntegrations();

  for (const integration of integrations) {
    const manifest = integration.manifest;

    // Register manifest-defined wake hooks
    if (manifest.wakeHooks) {
      for (const hook of manifest.wakeHooks) {
        const hookKey = `${manifest.id}:${hook.event}`;

        // Check if user has customized this hook's settings
        const db = await getDb();
        const [savedPrompt] = await db
          .select()
          .from(settings)
          .where(eq(settings.key, `wake_hook_prompt:${hookKey}`));
        const [savedEnabled] = await db
          .select()
          .from(settings)
          .where(eq(settings.key, `wake_hook_enabled:${hookKey}`));

        activeHooks.set(hookKey, {
          integrationId: manifest.id,
          event: hook.event,
          prompt: savedPrompt?.value || hook.defaultPrompt,
          enabled: savedEnabled?.value !== undefined
            ? savedEnabled.value === 'true'
            : (hook.enabledByDefault ?? true),
        });
      }
    }

    // Set up health monitoring with wake hooks
    if (integration.status !== 'unconfigured') {
      const interval = manifest.healthCheck.interval || 60;
      const cron = new Cron(`*/${Math.max(1, Math.floor(interval / 60))} * * * *`, async () => {
        await checkHealthAndFire(manifest.id);
      });

      healthMonitors.set(manifest.id, {
        integrationId: manifest.id,
        cron,
        lastStatus: integration.status === 'healthy' ? 'healthy' : 'unknown',
      });
    }
  }

  logger.info('scheduler', `Wake hooks initialized: ${activeHooks.size} hooks, ${healthMonitors.size} health monitors`);
}

/**
 * Check integration health and fire wake hooks on status change.
 */
async function checkHealthAndFire(integrationId: string) {
  const { healthCheck } = await import('../integrations/registry');
  const monitor = healthMonitors.get(integrationId);
  if (!monitor) return;

  try {
    const result = await healthCheck(integrationId);
    const newStatus = result.healthy ? 'healthy' : 'unhealthy';
    const oldStatus = monitor.lastStatus;

    if (oldStatus !== newStatus) {
      logger.info('scheduler', `Health status changed for ${integrationId}: ${oldStatus} -> ${newStatus}`);
      monitor.lastStatus = newStatus;

      // Fire appropriate wake hooks
      if (newStatus === 'unhealthy') {
        await fireWakeHook(integrationId, 'health_down', {
          integration: integrationId,
          previousStatus: oldStatus,
          message: result.message,
        });
      } else if (newStatus === 'healthy' && oldStatus === 'unhealthy') {
        await fireWakeHook(integrationId, 'health_recovered', {
          integration: integrationId,
          previousStatus: oldStatus,
          message: result.message,
        });
      }
    }
  } catch (e) {
    if (monitor.lastStatus !== 'unhealthy') {
      monitor.lastStatus = 'unhealthy';
      await fireWakeHook(integrationId, 'health_down', {
        integration: integrationId,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }
}

/**
 * Fire a wake hook event. This sends the hook's prompt to the agent.
 */
export async function fireWakeHook(
  integrationId: string,
  event: string,
  context?: Record<string, unknown>,
) {
  const hookKey = `${integrationId}:${event}`;
  const hook = activeHooks.get(hookKey);

  if (!hook || !hook.enabled) {
    // Check for a generic hook without specific integration prefix
    const genericHook = activeHooks.get(`${integrationId}:${event}`);
    if (!genericHook || !genericHook.enabled) return;
  }

  const activeHook = hook || activeHooks.get(`${integrationId}:${event}`);
  if (!activeHook) return;

  logger.info('scheduler', `Wake hook fired: ${hookKey}`, context);

  try {
    const { processMessage } = await import('../agent/core');
    const prompt = context
      ? `${activeHook.prompt}\n\nContext: ${JSON.stringify(context)}`
      : activeHook.prompt;

    let response = '';
    const stream = processMessage(prompt, `wake_hook_${hookKey}`, 'web');
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) {
        response += chunk.text;
      }
    }

    logger.info('scheduler', `Wake hook ${hookKey} completed`, { responseLength: response.length });

    // Send notification if configured
    const { getDb } = await import('../db/index');
    const { settings } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    const db = await getDb();
    const [notifSetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, `wake_hook_notify:${hookKey}`));

    if (notifSetting?.value) {
      const notif = JSON.parse(notifSetting.value) as { platform: string; chatId?: string };
      if (notif.platform === 'telegram' && notif.chatId) {
        const { config } = await import('../utils/config');
        if (config.telegramBotToken) {
          await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: notif.chatId,
              text: `🔔 Wake Hook: ${event}\n\n${response}`,
            }),
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    logger.error('scheduler', `Wake hook ${hookKey} failed`, e);
  }
}

/**
 * Fire a wake hook from a webhook event (called by webhook handlers).
 */
export async function fireWebhookWakeHook(
  integrationId: string,
  webhookEvent: string,
  payload: unknown,
) {
  await fireWakeHook(integrationId, 'webhook_received', {
    webhookEvent,
    payload,
  });
}

/**
 * Update a wake hook's prompt or enabled state.
 */
export async function updateWakeHook(
  integrationId: string,
  event: string,
  updates: { prompt?: string; enabled?: boolean },
) {
  const hookKey = `${integrationId}:${event}`;
  const hook = activeHooks.get(hookKey);

  const { getDb } = await import('../db/index');
  const { settings } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');
  const db = await getDb();

  if (updates.prompt !== undefined) {
    const key = `wake_hook_prompt:${hookKey}`;
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length) {
      await db.update(settings).set({ value: updates.prompt }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value: updates.prompt });
    }
    if (hook) hook.prompt = updates.prompt;
  }

  if (updates.enabled !== undefined) {
    const key = `wake_hook_enabled:${hookKey}`;
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length) {
      await db.update(settings).set({ value: String(updates.enabled) }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value: String(updates.enabled) });
    }
    if (hook) hook.enabled = updates.enabled;
  }
}

/**
 * Get all active wake hooks and their status.
 */
export function getWakeHooks(): Array<{
  integrationId: string;
  event: string;
  prompt: string;
  enabled: boolean;
}> {
  return Array.from(activeHooks.values());
}

/**
 * Stop all health monitors.
 */
export function stopWakeHooks() {
  for (const monitor of healthMonitors.values()) {
    monitor.cron.stop();
  }
  healthMonitors.clear();
}
