import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from '../utils/config';
import { processMessage } from '../agent/core';
import { logger } from '../utils/logger';
import type { ChatAdapter } from './adapter';

/** Maximum Discord message length. */
const MAX_MESSAGE_LENGTH = 2000;

export class DiscordAdapter implements ChatAdapter {
  platform = 'discord' as const;
  private client: Client | null = null;

  async start(): Promise<void> {
    if (!config.discordBotToken) {
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

    await this.client.login(config.discordBotToken);
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
