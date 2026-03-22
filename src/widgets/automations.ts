import { nanoid } from 'nanoid';
import { eq, and, lte } from 'drizzle-orm';
import { getDb } from '../db/index';
import { widgets, widgetAutomations, widgetAutomationRuns } from '../db/schema';
import { getWidgetControl, executeWidgetControl } from './controls';
import { logger } from '../utils/logger';
import type { WidgetAutomation, WidgetAutomationRunStatus, WidgetRecord } from './types';

// ─── Schedule Computation ────────────────────────────────────────────

export function computeNextRunAt(
  automation: Pick<WidgetAutomation, 'enabled' | 'scheduleKind' | 'intervalMinutes' | 'hourLocal' | 'minuteLocal' | 'lastRunAt' | 'createdAt'>,
  now: Date = new Date(),
): Date | undefined {
  if (!automation.enabled || automation.scheduleKind === 'manual') {
    return undefined;
  }

  if (automation.scheduleKind === 'interval') {
    const intervalMs = Math.max(1, automation.intervalMinutes ?? 0) * 60_000;
    const baseAt = new Date(automation.lastRunAt ?? automation.createdAt);
    let nextAt = new Date(baseAt.getTime() + intervalMs);
    while (nextAt.getTime() <= now.getTime()) {
      nextAt = new Date(nextAt.getTime() + intervalMs);
    }
    return nextAt;
  }

  // Daily
  const candidate = new Date(now);
  candidate.setHours(automation.hourLocal ?? 0, automation.minuteLocal ?? 0, 0, 0);

  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}

// ─── Run Automation ──────────────────────────────────────────────────

export async function runWidgetAutomation(automationId: string): Promise<{
  status: WidgetAutomationRunStatus;
  summary: string;
}> {
  const db = await getDb();

  const [auto] = await db.select().from(widgetAutomations).where(eq(widgetAutomations.id, automationId));
  if (!auto) throw new Error('Automation not found');

  const [widgetRow] = await db.select().from(widgets).where(eq(widgets.id, auto.widgetId));
  if (!widgetRow) {
    await recordRun(auto, 'failed', 'Widget not found');
    return { status: 'failed', summary: 'Widget not found' };
  }

  const widget: WidgetRecord = {
    id: widgetRow.id,
    slug: widgetRow.slug ?? '',
    name: widgetRow.name,
    description: widgetRow.description ?? undefined,
    status: (widgetRow.status as 'active' | 'disabled') ?? 'active',
    html: widgetRow.html,
    css: widgetRow.css ?? '',
    js: widgetRow.js ?? '',
    capabilities: widgetRow.capabilities ? JSON.parse(widgetRow.capabilities) : [],
    controls: widgetRow.controls ? JSON.parse(widgetRow.controls) : [],
    prompt: widgetRow.prompt ?? undefined,
    revision: widgetRow.revision ?? 1,
    createdBy: (widgetRow.createdBy as 'commandarr' | 'user') ?? 'user',
    refreshInterval: widgetRow.refreshInterval ?? 30000,
    createdAt: widgetRow.createdAt?.toISOString() ?? '',
    updatedAt: widgetRow.updatedAt?.toISOString() ?? '',
  };

  const control = getWidgetControl(widget, auto.controlId);
  if (!control) {
    await recordRun(auto, 'failed', 'Control not found');
    return { status: 'failed', summary: 'Control not found' };
  }

  try {
    const inputJson = auto.inputJson ? JSON.parse(auto.inputJson) : {};
    const result = await executeWidgetControl({ widget, control, inputValues: inputJson });

    const status: WidgetAutomationRunStatus = result.ok ? 'succeeded' : 'failed';
    await recordRun(auto, status, result.summary);

    // Update automation metadata
    const nextRunAt = computeNextRunAt({
      ...parseAutomation(auto),
      lastRunAt: new Date().toISOString(),
    });

    await db.update(widgetAutomations).set({
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastRunSummary: result.summary,
      nextRunAt: nextRunAt ?? null,
      updatedAt: new Date(),
    }).where(eq(widgetAutomations.id, automationId));

    return { status, summary: result.summary };
  } catch (error) {
    const summary = error instanceof Error ? error.message : 'Execution failed';
    await recordRun(auto, 'failed', summary);
    return { status: 'failed', summary };
  }
}

function parseAutomation(row: typeof widgetAutomations.$inferSelect): WidgetAutomation {
  return {
    id: row.id,
    widgetId: row.widgetId ?? '',
    controlId: row.controlId,
    name: row.name,
    description: row.description ?? undefined,
    enabled: row.enabled ?? true,
    scheduleKind: (row.scheduleKind as 'manual' | 'interval' | 'daily') ?? 'manual',
    intervalMinutes: row.intervalMinutes ?? undefined,
    hourLocal: row.hourLocal ?? undefined,
    minuteLocal: row.minuteLocal ?? undefined,
    inputJson: row.inputJson ? JSON.parse(row.inputJson) : {},
    lastRunAt: row.lastRunAt?.toISOString(),
    nextRunAt: row.nextRunAt?.toISOString(),
    lastRunStatus: (row.lastRunStatus as WidgetAutomationRunStatus) ?? undefined,
    lastRunSummary: row.lastRunSummary ?? undefined,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

async function recordRun(
  auto: typeof widgetAutomations.$inferSelect,
  status: WidgetAutomationRunStatus,
  summary: string,
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(widgetAutomationRuns).values({
      id: nanoid(),
      automationId: auto.id,
      widgetId: auto.widgetId,
      controlId: auto.controlId,
      status,
      summary,
      resultJson: JSON.stringify({ status, summary }),
      createdAt: new Date(),
      completedAt: new Date(),
    });
  } catch (error) {
    logger.error('widget', 'Failed to record automation run', { error });
  }
}

// ─── Scheduler ───────────────────────────────────────────────────────

let schedulerHandle: ReturnType<typeof setInterval> | undefined;
let sweepRunning = false;

async function sweepDueAutomations(): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;

  try {
    const db = await getDb();
    const now = new Date();

    const due = await db
      .select()
      .from(widgetAutomations)
      .where(
        and(
          eq(widgetAutomations.enabled, true),
          lte(widgetAutomations.nextRunAt, now),
        ),
      )
      .limit(25);

    for (const auto of due) {
      try {
        await runWidgetAutomation(auto.id);
      } catch (error) {
        logger.error('widget', `Automation ${auto.id} failed`, { error });
      }
    }
  } finally {
    sweepRunning = false;
  }
}

export function ensureWidgetAutomationScheduler(): void {
  if (schedulerHandle) return;

  schedulerHandle = setInterval(() => {
    void sweepDueAutomations();
  }, 60_000);

  // Run immediately on startup
  void sweepDueAutomations();
}

export function stopWidgetAutomationScheduler(): void {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = undefined;
}
