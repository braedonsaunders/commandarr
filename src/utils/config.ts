import { getDb } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Bootstrap config — only values needed before the DB is available.
 * These have sensible defaults and never change at runtime.
 */
export const config = {
  port: parseInt(process.env.PORT || '8484', 10),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || './data',
  encryptionKey: process.env.ENCRYPTION_KEY || 'commandarr-default-key-change-me',
  nodeEnv: process.env.NODE_ENV || 'production',
  get dbPath() {
    return `${this.dataDir}/commandarr.db`;
  },
};

/**
 * Retrieve a single setting from the DB.
 */
export async function getSetting(key: string): Promise<string> {
  try {
    const db = await getDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return row?.value?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Retrieve multiple settings from the DB in one query.
 */
export async function getSettings(...keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  try {
    const db = await getDb();
    const allSettings = await db.select().from(settings);
    for (const s of allSettings) {
      if (keys.length === 0 || keys.includes(s.key)) {
        result[s.key] = s.value || '';
      }
    }
  } catch {
    // DB not ready
  }
  return result;
}

/**
 * Check if basic auth is enabled (both username and password set in DB).
 */
export async function isAuthEnabled(): Promise<{ enabled: boolean; username: string; password: string }> {
  const s = await getSettings('authUsername', 'authPassword');
  const username = s.authUsername || '';
  const password = s.authPassword || '';
  return { enabled: !!(username && password), username, password };
}
