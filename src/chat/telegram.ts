import { Bot } from 'grammy';
import { getSetting } from '../utils/config';
import { processMessage } from '../agent/core';
import { logger } from '../utils/logger';
import { getDb } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ChatAdapter } from './adapter';

/** Maximum Telegram message length. */
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Resolve the Telegram bot token from DB settings first, then env var fallback.
 * Returns empty string if the Telegram integration is explicitly disabled.
 */
async function resolveBotToken(): Promise<string> {
  const enabled = await getSetting('telegramEnabled');
  if (enabled === 'false') return '';
  return getSetting('telegramBotToken');
}

/** Singleton adapter instance used for lifecycle management. */
let _instance: TelegramAdapter | null = null;

export class TelegramAdapter implements ChatAdapter {
  platform = 'telegram' as const;
  private bot: Bot | null = null;

  constructor() {
    _instance = this;
  }

  async start(): Promise<void> {
    const token = await resolveBotToken();

    if (!token) {
      logger.info('chat', 'Telegram bot token not configured, skipping');
      return;
    }

    this.bot = new Bot(token);

    this.bot.on('message:text', async (ctx) => {
      const chatId = ctx.chat.id.toString();
      const userId = ctx.from?.id?.toString();
      const message = ctx.message.text;

      // Check if this user is allowed
      if (userId && !(await isAllowedTelegramUser(userId))) {
        logger.info('chat', `Telegram message from unauthorized user ${userId}, ignoring`);
        return;
      }

      logger.info('chat', `Telegram message from ${chatId}: ${message.slice(0, 100)}`);

      // Send typing indicator
      await ctx.replyWithChatAction('typing');

      // Keep typing indicator alive for long processing
      const typingInterval = setInterval(() => {
        ctx.replyWithChatAction('typing').catch(() => {});
      }, 4000);

      try {
        // Process through agent core
        let response = '';
        const stream = processMessage(message, `telegram_${chatId}`, 'telegram');

        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.text) {
            response += chunk.text;
          } else if (chunk.type === 'error' && chunk.error) {
            response += `\n\nError: ${chunk.error}`;
          }
        }

        if (!response.trim()) {
          response = 'I processed your request but have nothing to report.';
        }

        // Send response, splitting if it exceeds Telegram's limit
        await sendTelegramResponse(ctx, response);
      } catch (err: any) {
        logger.error('chat', `Telegram handler error: ${err.message}`, err);
        await ctx.reply('Sorry, something went wrong processing your message.').catch(() => {});
      } finally {
        clearInterval(typingInterval);
      }
    });

    // Handle errors gracefully
    this.bot.catch((err) => {
      logger.error('chat', `Telegram bot error: ${err.message}`, err);
    });

    // Delete any leftover webhook so long-polling works
    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      logger.info('chat', 'Telegram webhook cleared, starting long-polling');
    } catch (e: any) {
      logger.warn('chat', `Failed to clear Telegram webhook: ${e.message}`);
    }

    // Validate token by calling getMe before starting polling
    try {
      const me = await this.bot.api.getMe();
      logger.info('chat', `Telegram bot authenticated as @${me.username} (${me.id})`);
    } catch (e: any) {
      logger.error('chat', `Telegram bot token invalid or API unreachable: ${e.message}`);
      this.bot = null;
      return;
    }

    // Start long-polling (fire-and-forget, but log errors)
    this.bot.start({
      onStart: () => logger.info('chat', 'Telegram bot polling for updates'),
    }).catch((err) => {
      logger.error('chat', `Telegram bot polling crashed: ${err.message}`, err);
    });
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
      logger.info('chat', 'Telegram bot stopped');
    }
  }
}

/**
 * Restart the Telegram bot (e.g. after token change in settings).
 * Creates a new adapter if none exists yet.
 */
export async function restartTelegramBot(): Promise<void> {
  logger.info('chat', 'Restarting Telegram bot...');
  if (_instance) {
    await _instance.stop();
    await _instance.start();
  } else {
    const adapter = new TelegramAdapter();
    await adapter.start();
  }
}

/**
 * Send a potentially long response to Telegram, splitting into
 * chunks if necessary. Tries Markdown first, falls back to plain text.
 */
async function sendTelegramResponse(ctx: any, response: string): Promise<void> {
  if (response.length <= MAX_MESSAGE_LENGTH) {
    await ctx.reply(response, { parse_mode: 'Markdown' }).catch(() =>
      ctx.reply(response),
    );
    return;
  }

  // Split on paragraph boundaries when possible, otherwise hard-split
  const chunks = splitMessage(response, MAX_MESSAGE_LENGTH);
  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() =>
      ctx.reply(chunk),
    );
  }
}

/**
 * Check if a Telegram user ID is in the allowed list.
 * Returns true if no allowed list is configured (allow all).
 */
async function isAllowedTelegramUser(userId: string): Promise<boolean> {
  try {
    const db = await getDb();
    const row = await db.select().from(settings).where(eq(settings.key, 'telegramAllowedUsers'));
    const allowedStr = row[0]?.value?.trim();
    if (!allowedStr) return true; // No restriction
    const allowed = allowedStr.split(',').map(s => s.trim()).filter(Boolean);
    return allowed.length === 0 || allowed.includes(userId);
  } catch {
    return true; // Fail open if DB error
  }
}

/**
 * Split a message into chunks of at most maxLen characters.
 * Prefers splitting on double-newlines (paragraphs), then single newlines, then spaces.
 */
function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitIdx = remaining.lastIndexOf('\n\n', maxLen);
    if (splitIdx <= 0) splitIdx = remaining.lastIndexOf('\n', maxLen);
    if (splitIdx <= 0) splitIdx = remaining.lastIndexOf(' ', maxLen);
    if (splitIdx <= 0) splitIdx = maxLen;

    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
