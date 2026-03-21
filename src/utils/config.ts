export const config = {
  port: parseInt(process.env.PORT || '8484', 10),
  dataDir: process.env.DATA_DIR || './data',
  encryptionKey: process.env.ENCRYPTION_KEY || 'commandarr-default-key-change-me',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  discordBotToken: process.env.DISCORD_BOT_TOKEN || '',
  plexRestartCommand: process.env.PLEX_RESTART_COMMAND || '',
  nodeEnv: process.env.NODE_ENV || 'production',
  get dbPath() {
    return `${this.dataDir}/commandarr.db`;
  },
};
