import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../db/index';
import {
  integrationCredentials,
  conversations,
  automations,
  automationRuns,
  widgets,
  widgetState,
  dashboardPages,
  dashboardPageItems,
  widgetOperationRuns,
  widgetAutomations,
  widgetAutomationRuns,
  llmProviders,
  settings,
  auditLog,
} from '../db/schema';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

export const api = new Hono();

// ──────────────────────────── Integrations ────────────────────────────

api.get('/integrations', async (c) => {
  const { getIntegrations } = await import('../integrations/registry');
  const integrations = getIntegrations();
  return c.json(integrations.map((i) => ({
    id: i.id,
    name: i.manifest.name,
    description: i.manifest.description,
    icon: i.manifest.icon,
    color: i.manifest.color,
    version: i.manifest.version,
    configured: i.status !== 'unconfigured',
    healthy: i.status === 'healthy',
    status: i.status,
    toolCount: i.tools.length,
    credentials: i.manifest.credentials,
    webhookPath: i.manifest.webhooks?.path,
  })));
});

api.get('/integrations/:id', async (c) => {
  const { getIntegrations, getTools, getCredentials } = await import('../integrations/registry');
  const id = c.req.param('id');
  const integrations = getIntegrations();
  const integration = integrations.find((i) => i.id === id);
  if (!integration) return c.json({ error: 'Not found' }, 404);
  const tools = getTools(id);
  const creds = await getCredentials(id);
  return c.json({
    id: integration.id,
    name: integration.manifest.name,
    description: integration.manifest.description,
    icon: integration.manifest.icon,
    color: integration.manifest.color,
    configured: integration.status !== 'unconfigured',
    healthy: integration.status === 'healthy',
    credentials: integration.manifest.credentials,
    currentCredentials: creds || {},
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      ui: t.ui,
    })),
    webhookPath: integration.manifest.webhooks?.path,
  });
});

api.put('/integrations/:id/creds', async (c) => {
  const id = c.req.param('id');
  const creds = await c.req.json();
  const { saveCredentials } = await import('../integrations/registry');
  await saveCredentials(id, creds);
  return c.json({ success: true });
});

api.post('/integrations/:id/test', async (c) => {
  const id = c.req.param('id');
  const { healthCheck } = await import('../integrations/registry');
  try {
    const result = await healthCheck(id);
    return c.json({ success: result.healthy, message: result.message });
  } catch (e) {
    return c.json({ success: false, message: e instanceof Error ? e.message : 'Connection failed' });
  }
});

api.get('/integrations/:id/tools', async (c) => {
  const id = c.req.param('id');
  const { getTools } = await import('../integrations/registry');
  const tools = getTools(id);
  return c.json(tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
    ui: t.ui,
  })));
});

api.post('/integrations/:id/tools/:toolId/test', async (c) => {
  const toolId = c.req.param('toolId');
  const params = await c.req.json().catch(() => ({}));
  const { executeTool } = await import('../integrations/registry');
  try {
    const result = await executeTool(toolId, params);
    return c.json(result);
  } catch (e) {
    return c.json({ success: false, message: e instanceof Error ? e.message : 'Tool execution failed' });
  }
});

// ──────────────────────────── Proxy ────────────────────────────

api.all('/proxy/:integrationId/*', async (c) => {
  const integrationId = c.req.param('integrationId');
  const path = '/' + (c.req.path.split('/').slice(4).join('/') || '');
  const { createClient } = await import('../integrations/registry');

  try {
    const client = await createClient(integrationId);
    const method = c.req.method.toLowerCase();
    let result;

    if (method === 'get') {
      result = await client.get(path + (c.req.url.includes('?') ? '?' + c.req.url.split('?')[1] : ''));
    } else if (method === 'post') {
      const body = await c.req.json().catch(() => undefined);
      result = await client.post(path, body);
    } else if (method === 'put') {
      const body = await c.req.json().catch(() => undefined);
      result = await client.put(path, body);
    } else if (method === 'delete') {
      result = await client.delete(path);
    }

    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Proxy error' }, 502);
  }
});

// ──────────────────────────── Chat ────────────────────────────

api.post('/chat', async (c) => {
  const { message, conversationId } = await c.req.json();
  const { processMessage } = await import('../agent/core');

  const convId = conversationId || `web_${nanoid()}`;
  let response = '';
  const toolCalls: unknown[] = [];

  try {
    const stream = processMessage(message, convId, 'web');
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) {
        response += chunk.text;
      }
      if (chunk.type === 'tool_call' && chunk.toolCall) {
        toolCalls.push(chunk.toolCall);
      }
    }

    return c.json({ conversationId: convId, response, toolCalls });
  } catch (e) {
    logger.error('server', 'Chat error', e);
    return c.json({ error: e instanceof Error ? e.message : 'Chat error' }, 500);
  }
});

api.get('/chat/history', async (c) => {
  const db = await getDb();
  const convos = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
  return c.json(
    convos.map((conv) => ({
      ...conv,
      messages: conv.messages ? JSON.parse(conv.messages) : [],
    })),
  );
});

api.delete('/chat/history/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  await db.delete(conversations).where(eq(conversations.id, id));
  return c.json({ success: true });
});

// ──────────────────────────── Automations ────────────────────────────

api.get('/automations', async (c) => {
  const db = await getDb();
  const { getNextRun } = await import('../scheduler/cron');
  const all = await db.select().from(automations).orderBy(desc(automations.createdAt));
  return c.json(
    all.map((a) => ({
      ...a,
      conditions: a.conditions ? JSON.parse(a.conditions) : null,
      notification: a.notification ? JSON.parse(a.notification) : null,
      nextRun: getNextRun(a.id),
    })),
  );
});

api.post('/automations', async (c) => {
  const body = await c.req.json();
  const id = nanoid();
  const db = await getDb();

  await db.insert(automations).values({
    id,
    name: body.name,
    enabled: body.enabled ?? true,
    schedule: body.schedule,
    prompt: body.prompt,
    conditions: body.conditions ? JSON.stringify(body.conditions) : null,
    notification: body.notification ? JSON.stringify(body.notification) : null,
    createdAt: new Date(),
  });

  if (body.enabled !== false) {
    const { scheduleAutomation } = await import('../scheduler/cron');
    scheduleAutomation(id, body.schedule, body.prompt, body.conditions ? JSON.stringify(body.conditions) : null, body.notification ? JSON.stringify(body.notification) : null);
  }

  return c.json({ id, success: true }, 201);
});

api.put('/automations/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = await getDb();

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.schedule !== undefined) updateData.schedule = body.schedule;
  if (body.prompt !== undefined) updateData.prompt = body.prompt;
  if (body.conditions !== undefined) updateData.conditions = JSON.stringify(body.conditions);
  if (body.notification !== undefined) updateData.notification = JSON.stringify(body.notification);

  await db.update(automations).set(updateData).where(eq(automations.id, id));

  // Reschedule
  const { scheduleAutomation, unscheduleAutomation } = await import('../scheduler/cron');
  const [auto] = await db.select().from(automations).where(eq(automations.id, id));
  if (auto) {
    if (auto.enabled) {
      scheduleAutomation(auto.id, auto.schedule, auto.prompt, auto.conditions, auto.notification);
    } else {
      unscheduleAutomation(auto.id);
    }
  }

  return c.json({ success: true });
});

api.delete('/automations/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const { unscheduleAutomation } = await import('../scheduler/cron');
  unscheduleAutomation(id);
  await db.delete(automationRuns).where(eq(automationRuns.automationId, id));
  await db.delete(automations).where(eq(automations.id, id));
  return c.json({ success: true });
});

api.post('/automations/:id/run', async (c) => {
  const id = c.req.param('id');
  const { triggerAutomation } = await import('../scheduler/cron');
  try {
    await triggerAutomation(id);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ success: false, message: e instanceof Error ? e.message : 'Failed' }, 500);
  }
});

api.get('/automations/:id/runs', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const runs = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.automationId, id))
    .orderBy(desc(automationRuns.startedAt))
    .limit(20);
  return c.json(
    runs.map((r) => ({
      ...r,
      toolCalls: r.toolCalls ? JSON.parse(r.toolCalls) : [],
    })),
  );
});

// ──────────────────────────── Widgets ────────────────────────────

function parseWidgetRow(w: typeof widgets.$inferSelect) {
  return {
    ...w,
    capabilities: w.capabilities ? JSON.parse(w.capabilities) : ['context'],
    controls: w.controls ? JSON.parse(w.controls) : [],
    position: w.position ? JSON.parse(w.position) : null,
  };
}

api.get('/widgets', async (c) => {
  const db = await getDb();
  const all = await db.select().from(widgets).orderBy(desc(widgets.createdAt));
  return c.json(all.map(parseWidgetRow));
});

api.get('/widgets/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const [widget] = await db.select().from(widgets).where(eq(widgets.id, id));
  if (!widget) return c.json({ error: 'Widget not found' }, 404);
  return c.json(parseWidgetRow(widget));
});

api.post('/widgets', async (c) => {
  const { prompt, name } = await c.req.json();
  const { generateWidget } = await import('../widgets/generator');
  try {
    const widget = await generateWidget(prompt, name);
    return c.json(widget, 201);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Generation failed' }, 500);
  }
});

api.put('/widgets/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = await getDb();

  const [existing] = await db.select().from(widgets).where(eq(widgets.id, id));
  if (!existing) return c.json({ error: 'Widget not found' }, 404);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.slug !== undefined) updateData.slug = body.slug;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.html !== undefined) updateData.html = body.html;
  if (body.css !== undefined) updateData.css = body.css;
  if (body.js !== undefined) updateData.js = body.js;
  if (body.capabilities !== undefined) updateData.capabilities = JSON.stringify(body.capabilities);
  if (body.controls !== undefined) updateData.controls = JSON.stringify(body.controls);
  if (body.position !== undefined) updateData.position = JSON.stringify(body.position);
  if (body.refreshInterval !== undefined) updateData.refreshInterval = body.refreshInterval;

  await db.update(widgets).set(updateData).where(eq(widgets.id, id));

  const [updated] = await db.select().from(widgets).where(eq(widgets.id, id));
  return c.json(parseWidgetRow(updated));
});

api.delete('/widgets/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();

  // Cascade delete related data
  await db.delete(dashboardPageItems).where(eq(dashboardPageItems.widgetId, id));
  await db.delete(widgetState).where(eq(widgetState.widgetId, id));
  await db.delete(widgetOperationRuns).where(eq(widgetOperationRuns.widgetId, id));
  await db.delete(widgets).where(eq(widgets.id, id));
  return c.json({ success: true });
});

api.post('/widgets/generate', async (c) => {
  const { prompt } = await c.req.json();
  const { generateWidget } = await import('../widgets/generator');
  try {
    const result = await generateWidget(prompt);
    return c.json({ html: result.html, css: result.css, js: result.js });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Generation failed' }, 500);
  }
});

// ──── Widget State ────

api.get('/widgets/:id/state', async (c) => {
  const id = c.req.param('id');
  const { getWidgetState } = await import('../widgets/controls');
  const state = await getWidgetState(id);
  return c.json({ state });
});

api.put('/widgets/:id/state', async (c) => {
  const id = c.req.param('id');
  const { state: stateData } = await c.req.json();
  const { updateWidgetState } = await import('../widgets/controls');
  const state = await updateWidgetState(id, stateData ?? {});
  return c.json({ state });
});

// ──── Widget Controls ────

api.get('/widgets/:id/controls', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  const [widget] = await db.select().from(widgets).where(eq(widgets.id, id));
  if (!widget) return c.json({ error: 'Widget not found' }, 404);
  return c.json({ controls: widget.controls ? JSON.parse(widget.controls) : [] });
});

api.post('/widgets/:id/controls', async (c) => {
  const id = c.req.param('id');
  const { controlId, input } = await c.req.json();
  const db = await getDb();

  const [row] = await db.select().from(widgets).where(eq(widgets.id, id));
  if (!row) return c.json({ error: 'Widget not found' }, 404);

  const widget = parseWidgetRow(row);
  const { getWidgetControl, executeWidgetControl } = await import('../widgets/controls');
  const control = getWidgetControl(widget, controlId);
  if (!control) return c.json({ error: 'Control not found' }, 404);

  if (control.execution.kind === 'operation' && !widget.capabilities.includes('integration-control')) {
    return c.json({ error: 'Widget does not have integration-control capability' }, 403);
  }

  const result = await executeWidgetControl({ widget, control, inputValues: input });
  return c.json(result, result.ok ? 200 : 409);
});

// ──── Widget Operations ────

api.post('/widgets/:id/operation', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = await getDb();

  const [row] = await db.select().from(widgets).where(eq(widgets.id, id));
  if (!row) return c.json({ error: 'Widget not found' }, 404);

  const widget = parseWidgetRow(row);
  if (!widget.capabilities.includes('integration-control')) {
    return c.json({ error: 'Widget does not have integration-control capability' }, 403);
  }

  const { executeWidgetOperation } = await import('../widgets/operations');
  const result = await executeWidgetOperation({ widget, operation: body.operation ?? body });
  return c.json(result, result.ok ? 200 : 409);
});

api.get('/widgets/:id/runs', async (c) => {
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const db = await getDb();

  const runs = await db
    .select()
    .from(widgetOperationRuns)
    .where(eq(widgetOperationRuns.widgetId, id))
    .orderBy(desc(widgetOperationRuns.createdAt))
    .limit(Math.min(limit, 100));

  return c.json({
    runs: runs.map((r) => ({
      ...r,
      operationJson: r.operationJson ? JSON.parse(r.operationJson) : {},
      detailsJson: r.detailsJson ? JSON.parse(r.detailsJson) : {},
    })),
  });
});

// ──────────────────────────── Dashboard Pages ────────────────────────────

api.get('/dashboard/widgets', async (c) => {
  const db = await getDb();
  const pages = await db.select().from(dashboardPages).orderBy(dashboardPages.sortOrder);
  const items = await db.select().from(dashboardPageItems);
  const allWidgets = await db.select().from(widgets);

  const widgetMap = new Map(allWidgets.map((w) => [w.id, w]));

  const result = pages.map((page) => ({
    ...page,
    items: items
      .filter((item) => item.pageId === page.id)
      .map((item) => {
        const w = widgetMap.get(item.widgetId);
        return {
          ...item,
          widget: w ? {
            widgetId: w.id,
            widgetSlug: w.slug,
            widgetName: w.name,
            widgetDescription: w.description,
            widgetStatus: w.status ?? 'active',
            widgetRevision: w.revision ?? 1,
            capabilities: w.capabilities ? JSON.parse(w.capabilities) : ['context'],
            updatedAt: w.updatedAt?.toISOString() ?? '',
          } : null,
        };
      })
      .filter((item) => item.widget !== null),
  }));

  // Widget inventory (all widgets not yet on any page)
  const inventory = allWidgets
    .filter((w) => (w.status ?? 'active') === 'active')
    .map((w) => ({
      widgetId: w.id,
      widgetSlug: w.slug,
      widgetName: w.name,
      widgetDescription: w.description,
      widgetStatus: w.status ?? 'active',
      widgetRevision: w.revision ?? 1,
      capabilities: w.capabilities ? JSON.parse(w.capabilities) : ['context'],
      updatedAt: w.updatedAt?.toISOString() ?? '',
    }));

  return c.json({ pages: result, inventory });
});

api.post('/dashboard/widgets', async (c) => {
  const { name } = await c.req.json();
  const db = await getDb();

  const id = nanoid();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const allPages = await db.select().from(dashboardPages);
  const sortOrder = allPages.length;

  await db.insert(dashboardPages).values({
    id,
    slug,
    name,
    sortOrder,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const [page] = await db.select().from(dashboardPages).where(eq(dashboardPages.id, id));
  return c.json({ page: { ...page, items: [] } }, 201);
});

api.patch('/dashboard/widgets/pages/:pageId', async (c) => {
  const pageId = c.req.param('pageId');
  const body = await c.req.json();
  const db = await getDb();

  const [existing] = await db.select().from(dashboardPages).where(eq(dashboardPages.id, pageId));
  if (!existing) return c.json({ error: 'Page not found' }, 404);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
  if (body.slug !== undefined) updateData.slug = body.slug;

  await db.update(dashboardPages).set(updateData).where(eq(dashboardPages.id, pageId));

  // Reorder items if provided
  if (Array.isArray(body.itemOrder)) {
    for (let i = 0; i < body.itemOrder.length; i++) {
      await db.update(dashboardPageItems)
        .set({ sortOrder: i })
        .where(eq(dashboardPageItems.id, body.itemOrder[i]));
    }
  }

  const [page] = await db.select().from(dashboardPages).where(eq(dashboardPages.id, pageId));
  return c.json({ page });
});

api.delete('/dashboard/widgets/pages/:pageId', async (c) => {
  const pageId = c.req.param('pageId');
  const db = await getDb();

  await db.delete(dashboardPageItems).where(eq(dashboardPageItems.pageId, pageId));
  await db.delete(dashboardPages).where(eq(dashboardPages.id, pageId));
  return c.json({ ok: true });
});

api.post('/dashboard/widgets/pages/:pageId/items', async (c) => {
  const pageId = c.req.param('pageId');
  const body = await c.req.json();
  const db = await getDb();

  const [page] = await db.select().from(dashboardPages).where(eq(dashboardPages.id, pageId));
  if (!page) return c.json({ error: 'Page not found' }, 404);

  const [widget] = await db.select().from(widgets).where(eq(widgets.id, body.widgetId));
  if (!widget) return c.json({ error: 'Widget not found' }, 404);

  // Auto-place if no position specified
  let columnStart = body.columnStart;
  let rowStart = body.rowStart;
  const columnSpan = body.columnSpan ?? 6;
  const rowSpan = body.rowSpan ?? 2;

  if (columnStart === undefined || rowStart === undefined) {
    const { findGridPlacement } = await import('../widgets/dashboard-grid');
    const existingItems = await db.select().from(dashboardPageItems).where(eq(dashboardPageItems.pageId, pageId));
    const gridItems = existingItems.map((item) => ({
      id: item.id,
      columnStart: item.columnStart ?? 1,
      columnSpan: item.columnSpan ?? 6,
      rowStart: item.rowStart ?? 1,
      rowSpan: item.rowSpan ?? 2,
      sortOrder: item.sortOrder ?? 0,
      createdAt: item.createdAt?.toISOString() ?? '',
    }));
    const placement = findGridPlacement(gridItems, columnSpan, rowSpan);
    columnStart = placement.columnStart;
    rowStart = placement.rowStart;
  }

  const id = nanoid();
  await db.insert(dashboardPageItems).values({
    id,
    pageId,
    widgetId: body.widgetId,
    title: body.title,
    columnStart,
    columnSpan,
    rowStart,
    rowSpan,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const [item] = await db.select().from(dashboardPageItems).where(eq(dashboardPageItems.id, id));
  return c.json({ item }, 201);
});

api.patch('/dashboard/widgets/items/:itemId', async (c) => {
  const itemId = c.req.param('itemId');
  const body = await c.req.json();
  const db = await getDb();

  const [existing] = await db.select().from(dashboardPageItems).where(eq(dashboardPageItems.id, itemId));
  if (!existing) return c.json({ error: 'Item not found' }, 404);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updateData.title = body.title;
  if (body.columnStart !== undefined) updateData.columnStart = body.columnStart;
  if (body.columnSpan !== undefined) updateData.columnSpan = body.columnSpan;
  if (body.rowStart !== undefined) updateData.rowStart = body.rowStart;
  if (body.rowSpan !== undefined) updateData.rowSpan = body.rowSpan;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  await db.update(dashboardPageItems).set(updateData).where(eq(dashboardPageItems.id, itemId));

  const [updated] = await db.select().from(dashboardPageItems).where(eq(dashboardPageItems.id, itemId));
  return c.json({ item: updated });
});

api.delete('/dashboard/widgets/items/:itemId', async (c) => {
  const itemId = c.req.param('itemId');
  const db = await getDb();

  await db.delete(dashboardPageItems).where(eq(dashboardPageItems.id, itemId));
  return c.json({ ok: true });
});

// ──────────────────────────── Widget Automations ────────────────────────────

api.get('/widgets/:id/automations', async (c) => {
  const widgetId = c.req.param('id');
  const db = await getDb();
  const autos = await db.select().from(widgetAutomations).where(eq(widgetAutomations.widgetId, widgetId));
  return c.json(
    autos.map((a) => ({
      ...a,
      inputJson: a.inputJson ? JSON.parse(a.inputJson) : {},
    })),
  );
});

api.post('/widgets/:id/automations', async (c) => {
  const widgetId = c.req.param('id');
  const body = await c.req.json();
  const db = await getDb();

  const id = nanoid();
  const now = new Date();

  await db.insert(widgetAutomations).values({
    id,
    widgetId,
    controlId: body.controlId,
    name: body.name,
    description: body.description,
    enabled: body.enabled ?? true,
    scheduleKind: body.scheduleKind ?? 'manual',
    intervalMinutes: body.intervalMinutes,
    hourLocal: body.hourLocal,
    minuteLocal: body.minuteLocal,
    inputJson: body.inputJson ? JSON.stringify(body.inputJson) : '{}',
    createdAt: now,
    updatedAt: now,
  });

  // Compute next run
  if (body.enabled !== false && body.scheduleKind !== 'manual') {
    const { computeNextRunAt } = await import('../widgets/automations');
    const nextRunAt = computeNextRunAt({
      enabled: true,
      scheduleKind: body.scheduleKind,
      intervalMinutes: body.intervalMinutes,
      hourLocal: body.hourLocal,
      minuteLocal: body.minuteLocal,
      lastRunAt: undefined,
      createdAt: now.toISOString(),
    });
    if (nextRunAt) {
      await db.update(widgetAutomations).set({ nextRunAt }).where(eq(widgetAutomations.id, id));
    }
  }

  const [auto] = await db.select().from(widgetAutomations).where(eq(widgetAutomations.id, id));
  return c.json({ ...auto, inputJson: auto.inputJson ? JSON.parse(auto.inputJson) : {} }, 201);
});

api.patch('/widgets/:id/automations/:autoId', async (c) => {
  const autoId = c.req.param('autoId');
  const body = await c.req.json();
  const db = await getDb();

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;
  if (body.scheduleKind !== undefined) updateData.scheduleKind = body.scheduleKind;
  if (body.intervalMinutes !== undefined) updateData.intervalMinutes = body.intervalMinutes;
  if (body.hourLocal !== undefined) updateData.hourLocal = body.hourLocal;
  if (body.minuteLocal !== undefined) updateData.minuteLocal = body.minuteLocal;
  if (body.inputJson !== undefined) updateData.inputJson = JSON.stringify(body.inputJson);

  await db.update(widgetAutomations).set(updateData).where(eq(widgetAutomations.id, autoId));

  const [auto] = await db.select().from(widgetAutomations).where(eq(widgetAutomations.id, autoId));
  return c.json({ ...auto, inputJson: auto.inputJson ? JSON.parse(auto.inputJson) : {} });
});

api.delete('/widgets/:id/automations/:autoId', async (c) => {
  const autoId = c.req.param('autoId');
  const db = await getDb();
  await db.delete(widgetAutomationRuns).where(eq(widgetAutomationRuns.automationId, autoId));
  await db.delete(widgetAutomations).where(eq(widgetAutomations.id, autoId));
  return c.json({ ok: true });
});

api.post('/widgets/:id/automations/:autoId/run', async (c) => {
  const autoId = c.req.param('autoId');
  const { runWidgetAutomation } = await import('../widgets/automations');
  try {
    const result = await runWidgetAutomation(autoId);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed' }, 500);
  }
});

// ──────────────────────────── Wake Hooks ────────────────────────────

api.get('/wake-hooks', async (c) => {
  const { getWakeHooks } = await import('../scheduler/wake-hooks');
  return c.json(getWakeHooks());
});

api.put('/wake-hooks/:integrationId/:event', async (c) => {
  const integrationId = c.req.param('integrationId');
  const event = c.req.param('event');
  const body = await c.req.json();
  const { updateWakeHook } = await import('../scheduler/wake-hooks');
  await updateWakeHook(integrationId, event, body);
  return c.json({ success: true });
});

// ──────────────────────────── LLM Providers ────────────────────────────

api.get('/llm/providers', async (c) => {
  const db = await getDb();
  const providers = await db.select().from(llmProviders).orderBy(llmProviders.priority);

  // Also return available provider types
  const { listAvailableProviderTypes } = await import('../llm/router');
  const available = listAvailableProviderTypes();

  return c.json({
    configured: providers.map((p) => ({
      ...p,
      config: p.config ? JSON.parse(decrypt(p.config)) : {},
    })),
    available: available.map((p) => ({
      id: p.id,
      name: p.name,
      configSchema: p.configSchema,
      supportsToolUse: true,
      supportsStreaming: true,
    })),
  });
});

api.put('/llm/providers/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = await getDb();

  const existing = await db.select().from(llmProviders).where(eq(llmProviders.id, id));

  if (existing.length) {
    await db
      .update(llmProviders)
      .set({
        config: encrypt(JSON.stringify(body.config)),
        model: body.model,
        enabled: body.enabled ?? true,
      })
      .where(eq(llmProviders.id, id));
  } else {
    const maxPriority = await db.select().from(llmProviders);
    await db.insert(llmProviders).values({
      id,
      providerId: body.providerId || id,
      config: encrypt(JSON.stringify(body.config)),
      model: body.model,
      priority: maxPriority.length,
      enabled: body.enabled ?? true,
    });
  }

  // Reinitialize providers
  const { initProviders } = await import('../llm/router');
  await initProviders();

  return c.json({ success: true });
});

api.post('/llm/providers/:id/test', async (c) => {
  const id = c.req.param('id');
  const { getProvider } = await import('../llm/router');
  const provider = getProvider(id);
  if (!provider) return c.json({ success: false, message: 'Provider not found' }, 404);

  try {
    const start = Date.now();
    let response = '';
    const stream = provider.chat([
      { role: 'user', content: 'Say "Hello from Commandarr!" and nothing else.' },
    ]);
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) response += chunk.text;
      if (chunk.type === 'error') throw new Error(chunk.error);
    }
    const latency = Date.now() - start;
    return c.json({ success: true, response, latency });
  } catch (e) {
    return c.json({ success: false, message: e instanceof Error ? e.message : 'Test failed' });
  }
});

api.get('/llm/providers/:id/models', async (c) => {
  const id = c.req.param('id');
  const { getProvider } = await import('../llm/router');
  const provider = getProvider(id);
  if (!provider) return c.json({ error: 'Provider not found' }, 404);

  try {
    const models = await provider.listModels();
    return c.json(models);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed to list models' }, 500);
  }
});

api.put('/llm/fallback-order', async (c) => {
  const { order } = await c.req.json();
  const db = await getDb();
  for (let i = 0; i < order.length; i++) {
    await db
      .update(llmProviders)
      .set({ priority: i })
      .where(eq(llmProviders.id, order[i]));
  }

  const { initProviders } = await import('../llm/router');
  await initProviders();

  return c.json({ success: true });
});

// ──────────────────────────── Push Notifications ────────────────────────────

api.post('/push/subscribe', async (c) => {
  const subscription = await c.req.json();
  const db = await getDb();

  // Store subscription in settings
  await db.insert(settings).values({
    key: `push_subscription:${nanoid(8)}`,
    value: JSON.stringify(subscription),
  });

  return c.json({ success: true });
});

api.delete('/push/subscribe', async (c) => {
  const { endpoint } = await c.req.json();
  const db = await getDb();

  // Find and remove subscription by endpoint
  const allSubs = await db.select().from(settings);
  for (const sub of allSubs) {
    if (sub.key.startsWith('push_subscription:')) {
      try {
        const parsed = JSON.parse(sub.value || '{}');
        if (parsed.endpoint === endpoint) {
          await db.delete(settings).where(eq(settings.key, sub.key));
        }
      } catch {}
    }
  }

  return c.json({ success: true });
});

// ──────────────────────────── Settings ────────────────────────────

api.get('/settings', async (c) => {
  const db = await getDb();
  const allSettings = await db.select().from(settings);
  const result: Record<string, string> = {};
  for (const s of allSettings) {
    result[s.key] = s.value || '';
  }
  return c.json(result);
});

api.put('/settings', async (c) => {
  const body = await c.req.json();
  const db = await getDb();
  for (const [key, value] of Object.entries(body)) {
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length) {
      await db.update(settings).set({ value: String(value) }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value: String(value) });
    }
  }
  return c.json({ success: true });
});

// ──────────────────────────── Audit Log ────────────────────────────

api.get('/logs', async (c) => {
  const db = await getDb();
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const level = c.req.query('level');
  const source = c.req.query('source');

  let query = db.select().from(auditLog).orderBy(desc(auditLog.timestamp)).limit(limit);

  const logs = await query;
  let filtered = logs;

  if (level && level !== 'all') {
    filtered = filtered.filter((l) => l.level === level);
  }
  if (source && source !== 'all') {
    filtered = filtered.filter((l) => l.source === source);
  }

  return c.json(filtered);
});
