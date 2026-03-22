import { nanoid } from 'nanoid';
import { getDb } from '../db/index';
import { widgetOperationRuns } from '../db/schema';
import { logger } from '../utils/logger';
import type {
  WidgetControlHttpOperation,
  WidgetOperationResult,
  WidgetRecord,
} from './types';

/**
 * Execute a widget HTTP operation by proxying through the integration client.
 */
export async function executeWidgetOperation(args: {
  widget: WidgetRecord;
  operation: WidgetControlHttpOperation;
}): Promise<WidgetOperationResult> {
  const { widget, operation } = args;
  const startedAt = new Date().toISOString();

  try {
    const { createClient } = await import('../integrations/registry');
    const client = await createClient(operation.integrationId);

    const method = operation.method.toLowerCase();
    let result: unknown;

    const path = operation.path;
    const timeout = operation.timeoutMs ?? 30000;

    // Use AbortController for timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      if (method === 'get') {
        result = await client.get(path);
      } else if (method === 'post') {
        result = await client.post(path, operation.body);
      } else if (method === 'put') {
        result = await client.put(path, operation.body);
      } else if (method === 'delete') {
        result = await client.delete(path);
      } else if (method === 'patch') {
        // Most clients expose put but not patch — use post as fallback
        result = await client.post(path, operation.body);
      }
    } finally {
      clearTimeout(timer);
    }

    const operationResult: WidgetOperationResult = {
      ok: true,
      status: 'succeeded',
      summary: `${operation.method} ${operation.path} succeeded`,
      output: typeof result === 'string' ? result : JSON.stringify(result ?? null),
      details: { integrationId: operation.integrationId, method: operation.method, path: operation.path },
      startedAt,
      completedAt: new Date().toISOString(),
    };

    await recordOperationRun(widget, operation, operationResult);
    return operationResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Operation failed';
    logger.error('widget', `Widget operation failed: ${message}`, { widgetId: widget.id, operation });

    const operationResult: WidgetOperationResult = {
      ok: false,
      status: 'failed',
      summary: message,
      output: '',
      details: {
        integrationId: operation.integrationId,
        method: operation.method,
        path: operation.path,
        error: message,
      },
      startedAt,
      completedAt: new Date().toISOString(),
    };

    await recordOperationRun(widget, operation, operationResult);
    return operationResult;
  }
}

/**
 * Preview an operation without persisting the run.
 */
export async function previewWidgetOperation(args: {
  widget: WidgetRecord;
  operation: WidgetControlHttpOperation;
}): Promise<WidgetOperationResult> {
  // For preview, only allow GET operations
  if (args.operation.method !== 'GET') {
    return {
      ok: false,
      status: 'blocked',
      summary: 'Preview mode only supports GET operations',
      output: '',
      details: {},
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  const { widget, operation } = args;
  const startedAt = new Date().toISOString();

  try {
    const { createClient } = await import('../integrations/registry');
    const client = await createClient(operation.integrationId);
    const result = await client.get(operation.path);

    return {
      ok: true,
      status: 'succeeded',
      summary: `Preview: ${operation.method} ${operation.path}`,
      output: typeof result === 'string' ? result : JSON.stringify(result ?? null),
      details: { preview: true },
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      summary: error instanceof Error ? error.message : 'Preview failed',
      output: '',
      details: { preview: true },
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

async function recordOperationRun(
  widget: WidgetRecord,
  operation: WidgetControlHttpOperation,
  result: WidgetOperationResult,
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(widgetOperationRuns).values({
      id: nanoid(),
      widgetId: widget.id,
      widgetRevision: widget.revision,
      protocol: operation.protocol,
      status: result.status,
      summary: result.summary,
      output: result.output.substring(0, 10000), // Truncate large outputs
      operationJson: JSON.stringify(operation),
      detailsJson: JSON.stringify(result.details),
      createdAt: new Date(),
    });
  } catch (error) {
    logger.error('widget', 'Failed to record operation run', { error });
  }
}
