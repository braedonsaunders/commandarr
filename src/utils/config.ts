export const config = {
  port: parseInt(process.env.PORT || '8484', 10),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || './data',
  encryptionKey: process.env.ENCRYPTION_KEY || 'commandarr-default-key-change-me',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
  plexRestartCommand: process.env.PLEX_RESTART_COMMAND || '',
  // Commandarr Helper - runs on host machine for OS-level actions
  helperUrl: process.env.HELPER_URL || '',
  helperToken: process.env.HELPER_TOKEN || '',
  nodeEnv: process.env.NODE_ENV || 'production',
  // Basic auth - set both to enable
  authUsername: process.env.AUTH_USERNAME || '',
  authPassword: process.env.AUTH_PASSWORD || '',
  get dbPath() {
    return `${this.dataDir}/commandarr.db`;
  },
  get authEnabled() {
    return !!(this.authUsername && this.authPassword);
  },
};
