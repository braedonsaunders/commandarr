import { Client, GatewayIntentBits, Events } from 'discord.js';
import { getSetting } from '../utils/config';
import { processMessage } from '../agent/core';
import { logger } from '../utils/logger';
import { getDb } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ChatAdapter } from './adapter';

/** Maximum Discord message length. */
const MAX_MESSAGE_LENGTH = 2000;

/** Singleton adapter instance used for lifecycle management. */
let _instance: DiscordAdapter | null = null;

export class DiscordAdapter implements ChatAdapter {
  platform = 'discord' as const;
  private client: Client | null = null;

  constructor() {
    _instance = this;
  }

  async start(): Promise<void> {
    const token = await resolveDiscordToken();

    if (!token) {
      logger.info('chat', 'Discord bot token not configured, skipping');
      return;
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.client.once(Events.ClientReady, (c) => {
      logger.info('chat', `Discord bot logged in as ${c.user.tag}`);
    });

    this.client.on(Events.MessageCreate, async (message) => {
      // Ignore messages from bots (including self)
      if (message.author.bot) return;

      // Only respond when mentioned or in DMs
      const isMentioned = this.client?.user && message.mentions.has(this.client.user);
      const isDM = !message.guild;

      if (!isMentioned && !isDM) return;

      // Check if this user is allowed
      const authorId = message.author.id;
      if (!(await isAllowedDiscordUser(authorId))) {
        logger.info('chat', `Discord message from unauthorized user ${message.author.tag} (${authorId}), ignoring`);
        return;
      }

      // Strip the bot mention from the message content
      let content = message.content;
      if (this.client?.user) {
        content = content.replace(new RegExp(`<@!?${this.client.user.id}>`, 'g'), '').trim();
      }

      if (!content) {
        await message.reply('How can I help?').catch(() => {});
        return;
      }

      const channelId = message.channel.id;
      logger.info('chat', `Discord message from ${message.author.tag} in ${channelId}: ${content.slice(0, 100)}`);

      // Show typing indicator
      const sendTyping = () => {
        message.channel.sendTyping().catch(() => {});
      };
      sendTyping();
      const typingInterval = setInterval(sendTyping, 8000);

      try {
        let response = '';
        const stream = processMessage(content, `discord_${channelId}`, 'discord');

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

        await sendDiscordResponse(message, response);
      } catch (err: any) {
        logger.error('chat', `Discord handler error: ${err.message}`, err);
        await message.reply('Sorry, something went wrong processing your message.').catch(() => {});
      } finally {
        clearInterval(typingInterval);
      }
    });

    this.client.on(Events.Error, (err) => {
      logger.error('chat', `Discord client error: ${err.message}`, err);
    });

    await this.client.login(token);
    logger.info('chat', 'Discord bot started');
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      logger.info('chat', 'Discord bot stopped');
    }
  }
}

/**
 * Restart the Discord bot (e.g. after token change in settings).
 */
export async function restartDiscordBot(): Promise<void> {
  logger.info('chat', 'Restarting Discord bot...');
  if (_instance) {
    await _instance.stop();
    await _instance.start();
  } else {
    const adapter = new DiscordAdapter();
    await adapter.start();
  }
}

/**
 * Resolve the Discord bot token from DB settings.
 */
async function resolveDiscordToken(): Promise<string> {
  const enabled = await getSetting('discordEnabled');
  if (enabled === 'false') return '';
  return getSetting('discordBotToken');
}

/**
 * Send a potentially long response to Discord, splitting into
 * chunks if necessary.
 */
async function sendDiscordResponse(message: any, response: string): Promise<void> {
  if (response.length <= MAX_MESSAGE_LENGTH) {
    await message.reply(response);
    return;
  }

  const chunks = splitMessage(response, MAX_MESSAGE_LENGTH);
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      await message.reply(chunks[i]);
    } else {
      await message.channel.send(chunks[i]);
    }
  }
}

/**
 * Check if a Discord user ID is in the allowed list.
 * Returns true if no allowed list is configured (allow all).
 */
async function isAllowedDiscordUser(userId: string): Promise<boolean> {
  try {
    const db = await getDb();
    const row = await db.select().from(settings).where(eq(settings.key, 'discordAllowedUsers'));
    const allowedStr = row[0]?.value?.trim();
    if (!allowedStr) return true;
    const allowed = allowedStr.split(',').map(s => s.trim()).filter(Boolean);
    return allowed.length === 0 || allowed.includes(userId);
  } catch {
    return true;
  }
}

/**
 * Split a message into chunks of at most maxLen characters.
 * Prefers splitting on double-newlines, then single newlines, then spaces.
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
