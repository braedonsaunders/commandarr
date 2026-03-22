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
      slug TEXT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      html TEXT NOT NULL,
      css TEXT DEFAULT '',
      js TEXT DEFAULT '',
      capabilities TEXT,
      controls TEXT,
      prompt TEXT,
      position TEXT,
      revision INTEGER DEFAULT 1,
      created_by TEXT DEFAULT 'user',
      refresh_interval INTEGER DEFAULT 30000,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS widget_state (
      widget_id TEXT PRIMARY KEY,
      state_json TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS dashboard_pages (
      id TEXT PRIMARY KEY,
      slug TEXT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS dashboard_page_items (
      id TEXT PRIMARY KEY,
      page_id TEXT REFERENCES dashboard_pages(id),
      widget_id TEXT REFERENCES widgets(id),
      title TEXT,
      column_start INTEGER DEFAULT 1,
      column_span INTEGER DEFAULT 6,
      row_start INTEGER DEFAULT 1,
      row_span INTEGER DEFAULT 2,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS widget_operation_runs (
      id TEXT PRIMARY KEY,
      widget_id TEXT REFERENCES widgets(id),
      widget_revision INTEGER,
      protocol TEXT,
      status TEXT,
      summary TEXT,
      output TEXT,
      operation_json TEXT,
      details_json TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS widget_automations (
      id TEXT PRIMARY KEY,
      widget_id TEXT REFERENCES widgets(id),
      control_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      schedule_kind TEXT DEFAULT 'manual',
      interval_minutes INTEGER,
      hour_local INTEGER,
      minute_local INTEGER,
      input_json TEXT,
      last_run_at INTEGER,
      next_run_at INTEGER,
      last_run_status TEXT,
      last_run_summary TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS widget_automation_runs (
      id TEXT PRIMARY KEY,
      automation_id TEXT REFERENCES widget_automations(id),
      widget_id TEXT,
      control_id TEXT,
      status TEXT,
      summary TEXT,
      result_json TEXT,
      created_at INTEGER,
      completed_at INTEGER
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

  // Migrate existing widgets table — add new columns if missing
  const migrateColumn = (table: string, column: string, type: string) => {
    try {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch {
      // Column already exists
    }
  };

  migrateColumn('widgets', 'slug', 'TEXT');
  migrateColumn('widgets', 'status', "TEXT DEFAULT 'active'");
  migrateColumn('widgets', 'css', "TEXT DEFAULT ''");
  migrateColumn('widgets', 'js', "TEXT DEFAULT ''");
  migrateColumn('widgets', 'capabilities', 'TEXT');
  migrateColumn('widgets', 'controls', 'TEXT');
  migrateColumn('widgets', 'revision', 'INTEGER DEFAULT 1');
  migrateColumn('widgets', 'created_by', "TEXT DEFAULT 'user'");

  sqlite.close();

  return db;
}

export { schema };
