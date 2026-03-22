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
  slug: text('slug'),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').$type<'active' | 'disabled'>().default('active'),
  html: text('html').notNull(),
  css: text('css').default(''),
  js: text('js').default(''),
  capabilities: text('capabilities'), // JSON array
  controls: text('controls'), // JSON array
  prompt: text('prompt'),
  position: text('position'),
  revision: integer('revision').default(1),
  createdBy: text('created_by').$type<'commandarr' | 'user'>().default('user'),
  refreshInterval: integer('refresh_interval').default(30000),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const widgetState = sqliteTable('widget_state', {
  widgetId: text('widget_id').primaryKey(),
  stateJson: text('state_json'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const dashboardPages = sqliteTable('dashboard_pages', {
  id: text('id').primaryKey(),
  slug: text('slug'),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const dashboardPageItems = sqliteTable('dashboard_page_items', {
  id: text('id').primaryKey(),
  pageId: text('page_id').references(() => dashboardPages.id),
  widgetId: text('widget_id').references(() => widgets.id),
  title: text('title'),
  columnStart: integer('column_start').default(1),
  columnSpan: integer('column_span').default(6),
  rowStart: integer('row_start').default(1),
  rowSpan: integer('row_span').default(2),
  sortOrder: integer('sort_order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const widgetOperationRuns = sqliteTable('widget_operation_runs', {
  id: text('id').primaryKey(),
  widgetId: text('widget_id').references(() => widgets.id),
  widgetRevision: integer('widget_revision'),
  protocol: text('protocol'),
  status: text('status').$type<'succeeded' | 'failed' | 'blocked'>(),
  summary: text('summary'),
  output: text('output'),
  operationJson: text('operation_json'),
  detailsJson: text('details_json'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const widgetAutomations = sqliteTable('widget_automations', {
  id: text('id').primaryKey(),
  widgetId: text('widget_id').references(() => widgets.id),
  controlId: text('control_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  scheduleKind: text('schedule_kind').$type<'manual' | 'interval' | 'daily'>().default('manual'),
  intervalMinutes: integer('interval_minutes'),
  hourLocal: integer('hour_local'),
  minuteLocal: integer('minute_local'),
  inputJson: text('input_json'),
  lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
  lastRunStatus: text('last_run_status').$type<'succeeded' | 'failed' | 'skipped'>(),
  lastRunSummary: text('last_run_summary'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const widgetAutomationRuns = sqliteTable('widget_automation_runs', {
  id: text('id').primaryKey(),
  automationId: text('automation_id').references(() => widgetAutomations.id),
  widgetId: text('widget_id'),
  controlId: text('control_id'),
  status: text('status').$type<'succeeded' | 'failed' | 'skipped'>(),
  summary: text('summary'),
  resultJson: text('result_json'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
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
