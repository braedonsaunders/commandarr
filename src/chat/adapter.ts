/**
 * Abstract interface for chat platform adapters.
 * Each adapter connects Commandarr to a specific messaging platform
 * (Telegram, Discord, etc.) and routes messages through the agent core.
 */
export interface ChatAdapter {
  /** Platform identifier. */
  platform: 'telegram' | 'discord' | 'web';

  /** Initialize and start listening for messages. */
  start(): Promise<void>;

  /** Gracefully shut down the adapter. */
  stop(): Promise<void>;
}
