import { logger } from '../utils/logger';
import type { ChatAdapter } from './adapter';

/**
 * Discord adapter stub.
 * Discord support is deferred for the MVP. This adapter logs a message
 * and does nothing, so it can be safely instantiated without crashing.
 */
export class DiscordAdapter implements ChatAdapter {
  platform = 'discord' as const;

  async start(): Promise<void> {
    logger.info('chat', 'Discord adapter is not yet implemented. Skipping.');
  }

  async stop(): Promise<void> {
    // Nothing to stop
  }
}
