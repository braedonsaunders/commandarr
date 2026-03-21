import { Cron } from 'croner';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { automations, automationRuns } from '../db/schema';
import { logger } from '../utils/logger';

interface ScheduledJob {
  automationId: string;
  cron: Cron;
}

const activeJobs: Map<string, ScheduledJob> = new Map();

export async function initScheduler() {
  const db = await getDb();
  const allAutomations = await db.select().from(automations);

  for (const auto of allAutomations) {
    if (auto.enabled) {
      scheduleAutomation(auto.id, auto.schedule, auto.prompt, auto.conditions, auto.notification);
    }
  }

  logger.info('scheduler', `Initialized ${activeJobs.size} scheduled automations`);
}

export function scheduleAutomation(
  automationId: string,
  schedule: string,
  prompt: string,
  conditionsJson: string | null,
  notificationJson: string | null,
) {
  // Remove existing job if any
  unscheduleAutomation(automationId);

  const job = new Cron(schedule, async () => {
    await runAutomation(automationId, prompt, conditionsJson, notificationJson);
  });

  activeJobs.set(automationId, { automationId, cron: job });
  logger.info('scheduler', `Scheduled automation ${automationId}: ${schedule}`);
}

export function unscheduleAutomation(automationId: string) {
  const existing = activeJobs.get(automationId);
  if (existing) {
    existing.cron.stop();
    activeJobs.delete(automationId);
  }
}

async function runAutomation(
  automationId: string,
  prompt: string,
  conditionsJson: string | null,
  notificationJson: string | null,
) {
  const runId = nanoid();
  const startedAt = new Date();

  logger.info('scheduler', `Running automation ${automationId}`);

  const db = await getDb();

  try {
    // Check conditions if any
    if (conditionsJson) {
      const conditions = JSON.parse(conditionsJson) as {
        integration: string;
        status: 'healthy' | 'unhealthy';
      };

      // Dynamically import registry to avoid circular deps
      const { healthCheck } = await import('../integrations/registry');
      const isHealthy = await healthCheck(conditions.integration);

      if (conditions.status === 'healthy' && !isHealthy) {
        logger.info('scheduler', `Skipping automation ${automationId}: ${conditions.integration} is not healthy`);
        return;
      }
      if (conditions.status === 'unhealthy' && isHealthy) {
        logger.info('scheduler', `Skipping automation ${automationId}: ${conditions.integration} is healthy`);
        return;
      }
    }

    // Process through agent
    const { processMessage } = await import('../agent/core');
    let result = '';
    const stream = processMessage(prompt, `automation_${automationId}`, 'web');
    const toolCalls: { tool: string; result: unknown }[] = [];

    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) {
        result += chunk.text;
      }
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        toolCalls.push({
          tool: chunk.toolCall.function.name,
          result: chunk.toolCall.function.arguments,
        });
      }
    }

    // Save run result
    await db.insert(automationRuns).values({
      id: runId,
      automationId,
      startedAt,
      completedAt: new Date(),
      result,
      toolCalls: JSON.stringify(toolCalls),
      status: 'success',
    });

    // Update automation last run
    await db.update(automations).set({
      lastRun: new Date(),
      lastResult: result,
    }).where(eq(automations.id, automationId));

    // Send notification if configured
    if (notificationJson) {
      const notification = JSON.parse(notificationJson) as {
        platform: 'telegram' | 'discord' | 'none';
        chatId?: string;
      };

      if (notification.platform !== 'none' && notification.chatId) {
        await sendNotification(notification.platform, notification.chatId, result);
      }
    }

    logger.info('scheduler', `Automation ${automationId} completed successfully`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('scheduler', `Automation ${automationId} failed: ${errorMsg}`);

    await db.insert(automationRuns).values({
      id: runId,
      automationId,
      startedAt,
      completedAt: new Date(),
      result: errorMsg,
      status: 'error',
    });

    await db.update(automations).set({
      lastRun: new Date(),
      lastResult: `Error: ${errorMsg}`,
    }).where(eq(automations.id, automationId));
  }
}

async function sendNotification(platform: string, chatId: string, message: string) {
  if (platform === 'telegram') {
    const { config } = await import('../utils/config');
    if (!config.telegramBotToken) return;

    try {
      await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
    } catch (e) {
      // Fallback without markdown
      await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      }).catch(() => {});
    }
  }
}

export function getNextRun(automationId: string): Date | null {
  const job = activeJobs.get(automationId);
  if (!job) return null;
  return job.cron.nextRun() ?? null;
}

export async function triggerAutomation(automationId: string) {
  const db = await getDb();
  const [auto] = await db.select().from(automations).where(eq(automations.id, automationId));
  if (!auto) throw new Error(`Automation ${automationId} not found`);

  await runAutomation(auto.id, auto.prompt, auto.conditions, auto.notification);
}
