import { Bot } from 'grammy';
import { config } from '../utils/config';
import { processMessage } from '../agent/core';
import { logger } from '../utils/logger';
import { getDb } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ChatAdapter } from './adapter';

/** Maximum Telegram message length. */
const MAX_MESSAGE_LENGTH = 4096;

export class TelegramAdapter implements ChatAdapter {
  platform = 'telegram' as const;
  private bot: Bot | null = null;

  async start(): Promise<void> {
    if (!config.telegramBotToken) {
      logger.info('chat', 'Telegram bot token not configured, skipping');
      return;
    }

    this.bot = new Bot(config.telegramBotToken);

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

    this.bot.start();
    logger.info('chat', 'Telegram bot started');
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
