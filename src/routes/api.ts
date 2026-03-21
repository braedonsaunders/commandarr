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

api.get('/widgets', async (c) => {
  const db = await getDb();
  const all = await db.select().from(widgets).orderBy(desc(widgets.createdAt));
  return c.json(
    all.map((w) => ({
      ...w,
      position: w.position ? JSON.parse(w.position) : null,
    })),
  );
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

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;
  if (body.html !== undefined) updateData.html = body.html;
  if (body.position !== undefined) updateData.position = JSON.stringify(body.position);
  if (body.refreshInterval !== undefined) updateData.refreshInterval = body.refreshInterval;

  await db.update(widgets).set(updateData).where(eq(widgets.id, id));
  return c.json({ success: true });
});

api.delete('/widgets/:id', async (c) => {
  const id = c.req.param('id');
  const db = await getDb();
  await db.delete(widgets).where(eq(widgets.id, id));
  return c.json({ success: true });
});

api.post('/widgets/generate', async (c) => {
  const { prompt } = await c.req.json();
  const { generateWidget } = await import('../widgets/generator');
  try {
    const result = await generateWidget(prompt);
    return c.json({ html: result.html });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Generation failed' }, 500);
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
