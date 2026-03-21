import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const integrationCredentials = sqliteTable('integration_credentials', {
  id: text('id').primaryKey(),
  credentials: text('credentials'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  lastHealthCheck: integer('last_health_check', { mode: 'timestamp' }),
  lastHealthStatus: text('last_health_status').$type<'healthy' | 'unhealthy' | 'unknown'>(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  platform: text('platform').$type<'web' | 'telegram' | 'discord'>(),
  platformChatId: text('platform_chat_id'),
  messages: text('messages'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const automations = sqliteTable('automations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  schedule: text('schedule').notNull(),
  prompt: text('prompt').notNull(),
  conditions: text('conditions'),
  notification: text('notification'),
  lastRun: integer('last_run', { mode: 'timestamp' }),
  lastResult: text('last_result'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const automationRuns = sqliteTable('automation_runs', {
  id: text('id').primaryKey(),
  automationId: text('automation_id').references(() => automations.id),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  result: text('result'),
  toolCalls: text('tool_calls'),
  status: text('status').$type<'success' | 'error'>(),
});

export const widgets = sqliteTable('widgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  html: text('html').notNull(),
  prompt: text('prompt'),
  position: text('position'),
  refreshInterval: integer('refresh_interval').default(30000),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const llmProviders = sqliteTable('llm_providers', {
  id: text('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  config: text('config'),
  model: text('model'),
  priority: integer('priority').default(0),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
});

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  timestamp: integer('timestamp', { mode: 'timestamp' }),
  source: text('source'),
  action: text('action'),
  integration: text('integration'),
  input: text('input'),
  output: text('output'),
  level: text('level').$type<'info' | 'warn' | 'error'>(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});
