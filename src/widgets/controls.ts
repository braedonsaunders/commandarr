import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index';
import { widgets, widgetState } from '../db/schema';
import { executeWidgetOperation } from './operations';
import type {
  WidgetControl,
  WidgetControlExecution,
  WidgetControlResult,
  WidgetRecord,
  WidgetRuntimeState,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────

export function getWidgetControl(widget: WidgetRecord, controlId: string): WidgetControl | null {
  return widget.controls.find((c) => c.id === controlId) ?? null;
}

export function normalizeScalarValue(
  value: unknown,
  type: 'string' | 'number' | 'boolean' | 'enum',
): string | number | boolean {
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return Boolean(value);
  }
  if (type === 'number') {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }
  return String(value ?? '');
}

/**
 * Interpolate `{{variable}}` placeholders in a structured value with input values.
 */
export function interpolateStructuredValue(
  template: unknown,
  variables: Record<string, unknown>,
): unknown {
  if (typeof template === 'string') {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = variables[key];
      return val !== undefined ? String(val) : '';
    });
  }
  if (Array.isArray(template)) {
    return template.map((item) => interpolateStructuredValue(item, variables));
  }
  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(template as Record<string, unknown>)) {
      result[key] = interpolateStructuredValue(val, variables);
    }
    return result;
  }
  return template;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, val] of Object.entries(source)) {
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      );
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ─── Get / Update Widget State ───────────────────────────────────────

export async function getWidgetState(widgetId: string): Promise<WidgetRuntimeState> {
  const db = await getDb();
  const [row] = await db.select().from(widgetState).where(eq(widgetState.widgetId, widgetId));
  if (row) {
    return {
      widgetId: row.widgetId,
      stateJson: row.stateJson ? JSON.parse(row.stateJson) : {},
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }
  return { widgetId, stateJson: {}, updatedAt: new Date().toISOString() };
}

export async function updateWidgetState(
  widgetId: string,
  state: Record<string, unknown>,
): Promise<WidgetRuntimeState> {
  const db = await getDb();
  const now = new Date();
  const json = JSON.stringify(state);

  const [existing] = await db.select().from(widgetState).where(eq(widgetState.widgetId, widgetId));
  if (existing) {
    await db.update(widgetState).set({ stateJson: json, updatedAt: now }).where(eq(widgetState.widgetId, widgetId));
  } else {
    await db.insert(widgetState).values({ widgetId, stateJson: json, updatedAt: now });
  }

  return { widgetId, stateJson: state, updatedAt: now.toISOString() };
}

// ─── Execute Control ─────────────────────────────────────────────────

export async function executeWidgetControl(args: {
  widget: WidgetRecord;
  control: WidgetControl;
  inputValues?: Record<string, unknown>;
}): Promise<WidgetControlResult> {
  const { widget, control, inputValues = {} } = args;
  const startedAt = new Date().toISOString();

  // Normalize input values against parameter types
  const normalizedInput: Record<string, unknown> = {};
  for (const param of control.parameters) {
    const raw = inputValues[param.key] ?? param.defaultValue;
    if (raw !== undefined) {
      normalizedInput[param.key] = normalizeScalarValue(raw, param.type);
    }
  }

  try {
    if (control.execution.kind === 'state') {
      return await executeStateControl(widget, control, normalizedInput, startedAt);
    } else {
      return await executeOperationControl(widget, control, normalizedInput, startedAt);
    }
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      summary: error instanceof Error ? error.message : 'Control execution failed',
      widgetId: widget.id,
      widgetName: widget.name,
      controlId: control.id,
      controlLabel: control.label,
      executionKind: control.execution.kind,
      details: { error: error instanceof Error ? error.message : String(error) },
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

async function executeStateControl(
  widget: WidgetRecord,
  control: WidgetControl,
  input: Record<string, unknown>,
  startedAt: string,
): Promise<WidgetControlResult> {
  const exec = control.execution as { kind: 'state'; patch: Record<string, unknown>; mergeStrategy?: string };
  const interpolated = interpolateStructuredValue(exec.patch, input) as Record<string, unknown>;

  const currentState = await getWidgetState(widget.id);
  const strategy = exec.mergeStrategy ?? 'deep-merge';
  const newState = strategy === 'replace'
    ? interpolated
    : deepMerge(currentState.stateJson, interpolated);

  const updated = await updateWidgetState(widget.id, newState);

  return {
    ok: true,
    status: 'succeeded',
    summary: control.successMessage ?? `${control.label} completed`,
    widgetId: widget.id,
    widgetName: widget.name,
    controlId: control.id,
    controlLabel: control.label,
    executionKind: 'state',
    details: { patch: interpolated, strategy },
    stateJson: updated.stateJson,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

async function executeOperationControl(
  widget: WidgetRecord,
  control: WidgetControl,
  input: Record<string, unknown>,
  startedAt: string,
): Promise<WidgetControlResult> {
  const exec = control.execution as {
    kind: 'operation';
    operation: { protocol: 'http'; integrationId: string; method: string; path: string; headers?: Record<string, string>; body?: unknown; timeoutMs?: number };
  };

  // Interpolate template variables in the operation
  const operation = interpolateStructuredValue(exec.operation, input) as typeof exec.operation;

  const result = await executeWidgetOperation({
    widget,
    operation,
  });

  return {
    ok: result.ok,
    status: result.status,
    summary: result.ok
      ? (control.successMessage ?? `${control.label} completed`)
      : result.summary,
    widgetId: widget.id,
    widgetName: widget.name,
    controlId: control.id,
    controlLabel: control.label,
    executionKind: 'operation',
    details: result.details,
    operationResult: result,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}
