import { z } from 'zod';

// ─── Widget Status & Capabilities ────────────────────────────────────

export type WidgetStatus = 'active' | 'disabled';
export type WidgetCapability = 'context' | 'state' | 'integration-control';
export type WidgetControlKind = 'button' | 'toggle' | 'select' | 'form';
export type WidgetControlParameterType = 'string' | 'number' | 'boolean' | 'enum';
export type WidgetControlStateMergeStrategy = 'deep-merge' | 'replace';

// ─── Widget Control Types ────────────────────────────────────────────

export interface WidgetControlOption {
  label: string;
  value: string;
  description?: string;
}

export interface WidgetControlParameter {
  key: string;
  label: string;
  description?: string;
  type: WidgetControlParameterType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: WidgetControlOption[];
}

export interface WidgetControlHttpOperation {
  protocol: 'http';
  integrationId: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface WidgetControlOperationExecution {
  kind: 'operation';
  operation: WidgetControlHttpOperation;
}

export interface WidgetControlStateExecution {
  kind: 'state';
  patch: Record<string, unknown>;
  mergeStrategy?: WidgetControlStateMergeStrategy;
}

export type WidgetControlExecution =
  | WidgetControlOperationExecution
  | WidgetControlStateExecution;

export interface WidgetControl {
  id: string;
  label: string;
  description?: string;
  kind: WidgetControlKind;
  parameters: WidgetControlParameter[];
  execution: WidgetControlExecution;
  confirmation?: string;
  successMessage?: string;
  danger?: boolean;
}

// ─── Widget Record ───────────────────────────────────────────────────

export interface WidgetRecord {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: WidgetStatus;
  html: string;
  css: string;
  js: string;
  capabilities: WidgetCapability[];
  controls: WidgetControl[];
  prompt?: string;
  revision: number;
  createdBy: 'commandarr' | 'user';
  refreshInterval: number;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetRuntimeState {
  widgetId: string;
  stateJson: Record<string, unknown>;
  updatedAt: string;
}

// ─── Dashboard Types ─────────────────────────────────────────────────

export interface DashboardPageRecord {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPageItemRecord {
  id: string;
  pageId: string;
  widgetId: string;
  title?: string;
  columnStart: number;
  columnSpan: number;
  rowStart: number;
  rowSpan: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardPageItem extends DashboardPageItemRecord {
  widget: WidgetInventoryEntry;
}

export interface DashboardPage extends DashboardPageRecord {
  items: DashboardPageItem[];
}

export interface WidgetInventoryEntry {
  widgetId: string;
  widgetSlug: string;
  widgetName: string;
  widgetDescription?: string;
  widgetStatus: WidgetStatus;
  widgetRevision: number;
  capabilities: WidgetCapability[];
  updatedAt: string;
}

// ─── Operation Types ─────────────────────────────────────────────────

export type WidgetOperationStatus = 'succeeded' | 'failed' | 'blocked';

export interface WidgetOperationResult {
  ok: boolean;
  status: WidgetOperationStatus;
  summary: string;
  output: string;
  details: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
}

export interface WidgetControlResult {
  ok: boolean;
  status: WidgetOperationStatus | 'succeeded';
  summary: string;
  widgetId: string;
  widgetName: string;
  controlId: string;
  controlLabel: string;
  executionKind: WidgetControlExecution['kind'];
  details: Record<string, unknown>;
  stateJson?: Record<string, unknown>;
  operationResult?: WidgetOperationResult;
  startedAt: string;
  completedAt: string;
}

export interface WidgetOperationRun {
  id: string;
  widgetId: string;
  widgetRevision: number;
  protocol: string;
  status: WidgetOperationStatus;
  summary: string;
  output: string;
  operationJson: Record<string, unknown>;
  detailsJson: Record<string, unknown>;
  createdAt: string;
}

// ─── Automation Types ────────────────────────────────────────────────

export type WidgetAutomationScheduleKind = 'manual' | 'interval' | 'daily';
export type WidgetAutomationRunStatus = 'succeeded' | 'failed' | 'skipped';

export interface WidgetAutomation {
  id: string;
  widgetId: string;
  controlId: string;
  name: string;
  description?: string;
  enabled: boolean;
  scheduleKind: WidgetAutomationScheduleKind;
  intervalMinutes?: number;
  hourLocal?: number;
  minuteLocal?: number;
  inputJson: Record<string, unknown>;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunStatus?: WidgetAutomationRunStatus;
  lastRunSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetAutomationRun {
  id: string;
  automationId: string;
  widgetId: string;
  controlId: string;
  status: WidgetAutomationRunStatus;
  summary: string;
  resultJson: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────

export const WidgetControlParameterSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  type: z.enum(['string', 'number', 'boolean', 'enum']),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  placeholder: z.string().max(100).optional(),
  options: z.array(z.object({
    label: z.string().min(1).max(80),
    value: z.string().min(1).max(200),
    description: z.string().max(200).optional(),
  })).optional(),
});

export const WidgetControlHttpOperationSchema = z.object({
  protocol: z.literal('http'),
  integrationId: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string().min(1),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
});

export const WidgetControlExecutionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('operation'),
    operation: WidgetControlHttpOperationSchema,
  }),
  z.object({
    kind: z.literal('state'),
    patch: z.record(z.string(), z.unknown()),
    mergeStrategy: z.enum(['deep-merge', 'replace']).optional(),
  }),
]);

export const WidgetControlSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  kind: z.enum(['button', 'toggle', 'select', 'form']),
  parameters: z.array(WidgetControlParameterSchema).max(20).default([]),
  execution: WidgetControlExecutionSchema,
  confirmation: z.string().max(200).optional(),
  successMessage: z.string().max(200).optional(),
  danger: z.boolean().optional(),
});

export const WidgetControlListSchema = z.array(WidgetControlSchema).max(40).default([]);

export const GeneratedWidgetSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().min(1).max(96),
  capabilities: z.array(z.enum(['context', 'state', 'integration-control'])).min(1).max(3),
  controls: WidgetControlListSchema,
  html: z.string().min(1).max(24000),
  css: z.string().max(24000).default(''),
  js: z.string().min(1).max(48000),
  summary: z.string().min(1).max(320),
});
