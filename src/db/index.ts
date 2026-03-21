import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { config } from '../utils/config';
import * as schema from './schema';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getDb() {
  if (_db) return _db;

  await mkdir(dirname(config.dbPath), { recursive: true });

  const sqlite = new Database(config.dbPath);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');

  _db = drizzle(sqlite, { schema });
  return _db;
}

export async function initDb() {
  const db = await getDb();

  // Create tables if they don't exist
  const sqlite = new Database(config.dbPath);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS integration_credentials (
      id TEXT PRIMARY KEY,
      credentials TEXT,
      enabled INTEGER DEFAULT 1,
      last_health_check INTEGER,
      last_health_status TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      platform TEXT,
      platform_chat_id TEXT,
      messages TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      schedule TEXT NOT NULL,
      prompt TEXT NOT NULL,
      conditions TEXT,
      notification TEXT,
      last_run INTEGER,
      last_result TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      automation_id TEXT REFERENCES automations(id),
      started_at INTEGER,
      completed_at INTEGER,
      result TEXT,
      tool_calls TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS widgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      html TEXT NOT NULL,
      prompt TEXT,
      position TEXT,
      refresh_interval INTEGER DEFAULT 30000,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS llm_providers (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      config TEXT,
      model TEXT,
      priority INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp INTEGER,
      source TEXT,
      action TEXT,
      integration TEXT,
      input TEXT,
      output TEXT,
      level TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  sqlite.close();

  return db;
}

export { schema };
