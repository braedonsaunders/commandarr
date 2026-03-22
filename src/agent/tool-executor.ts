import type { ToolDefinition, ToolResult, ToolContext, IntegrationClient } from '../integrations/_base';
import type { ToolDef } from '../llm/provider';
import { getDb } from '../db/index';
import { auditLog } from '../db/schema';
import { logger } from '../utils/logger';
import { nanoid } from 'nanoid';

// ─── Built-in system tools (not tied to any integration) ────────────

const builtInTools: ToolDefinition[] = [
  {
    name: 'commandarr_create_widget',
    integration: '_system',
    description: 'Create a live dashboard widget. The widget will be auto-generated as a self-contained HTML/CSS/JS app that polls data from integrations in real-time. Use this when the user asks to create, make, or build a widget. Be very descriptive in the description - specify exactly what data to show, what layout to use, and which integrations to pull from.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Detailed description of the widget. Include: what data to show, which integration(s), layout preferences, refresh rate. E.g. "Show currently playing Plex streams with user name, media title, progress bar, and transcode status. Refresh every 10 seconds. Show empty state when nothing is playing."',
        },
        name: {
          type: 'string',
          description: 'Short display name for the widget (e.g. "Now Playing", "Download Queue")',
        },
      },
      required: ['description', 'name'],
    },
    ui: { category: 'System', dangerLevel: 'low', testable: false },
    handler: async (params) => {
      const { generateWidget } = await import('../widgets/generator');
      try {
        const widget = await generateWidget(params.description, params.name);
        return {
          success: true,
          message: `Widget "${widget.name}" created and added to your dashboard. It will auto-refresh with live data.`,
          data: { id: widget.id, name: widget.name },
        };
      } catch (e) {
        return { success: false, message: `Failed to create widget: ${e instanceof Error ? e.message : 'Unknown error'}` };
      }
    },
  },
  {
    name: 'commandarr_update_widget',
    integration: '_system',
    description: 'Update an existing dashboard widget. Use this when the user wants to modify, change, or improve a widget they already have.',
    parameters: {
      type: 'object',
      properties: {
        widget_id: {
          type: 'string',
          description: 'The ID of the widget to update. Use commandarr_list_widgets first to find the ID.',
        },
        changes: {
          type: 'string',
          description: 'Description of what to change (e.g. "add a progress bar", "change the refresh rate to 5 seconds", "show poster images")',
        },
      },
      required: ['widget_id', 'changes'],
    },
    ui: { category: 'System', dangerLevel: 'low', testable: false },
    handler: async (params) => {
      const { updateWidget } = await import('../widgets/generator');
      try {
        const widget = await updateWidget(params.widget_id, params.changes);
        return {
          success: true,
          message: `Widget "${widget.name}" updated successfully.`,
          data: { id: widget.id, name: widget.name },
        };
      } catch (e) {
        return { success: false, message: `Failed to update widget: ${e instanceof Error ? e.message : 'Unknown error'}` };
      }
    },
  },
  {
    name: 'commandarr_list_widgets',
    integration: '_system',
    description: 'List all dashboard widgets with their IDs and names. Use this to find a widget ID before updating it.',
    parameters: {
      type: 'object',
      properties: {},
    },
    ui: { category: 'System', dangerLevel: 'low', testable: true },
    handler: async () => {
      const { listWidgets } = await import('../widgets/generator');
      const widgetList = await listWidgets();
      if (widgetList.length === 0) {
        return { success: true, message: 'No widgets on the dashboard yet.', data: [] };
      }
      return {
        success: true,
        message: `Found ${widgetList.length} widget(s) on the dashboard.`,
        data: widgetList,
      };
    },
  },
  {
    name: 'commandarr_diagnose',
    integration: '_system',
    description:
      'Run a health diagnosis across all configured integrations. Returns the status of each service and identifies any issues in the media pipeline.',
    parameters: {
      type: 'object',
      properties: {},
    },
    ui: { category: 'System', dangerLevel: 'low', testable: true },
    handler: async (_params, _ctx) => {
      const registry = await import('../integrations/registry');
      const integrations = registry.getIntegrations();
      const configured = integrations.filter((i) => i.status !== 'unconfigured');

      if (configured.length === 0) {
        return {
          success: true,
          message: 'No integrations are configured. Guide the user to set them up in Settings.',
          data: { configured: 0, results: [] },
        };
      }

      const results: Array<{
        id: string;
        name: string;
        healthy: boolean;
        message: string;
      }> = [];

      await Promise.allSettled(
        configured.map(async (integration) => {
          try {
            const check = await registry.healthCheck(integration.manifest.id);
            results.push({
              id: integration.manifest.id,
              name: integration.manifest.name,
              healthy: check.healthy,
              message: check.message,
            });
          } catch (err) {
            results.push({
              id: integration.manifest.id,
              name: integration.manifest.name,
              healthy: false,
              message: err instanceof Error ? err.message : 'Health check failed',
            });
          }
        }),
      );

      const healthyCount = results.filter((r) => r.healthy).length;
      const unhealthyCount = results.length - healthyCount;

      let summary = `Diagnosed ${results.length} integration(s): ${healthyCount} healthy`;
      if (unhealthyCount > 0) {
        const unhealthyNames = results
          .filter((r) => !r.healthy)
          .map((r) => r.name)
          .join(', ');
        summary += `, ${unhealthyCount} unhealthy (${unhealthyNames})`;
      }

      return {
        success: true,
        message: summary,
        data: { configured: configured.length, healthy: healthyCount, unhealthy: unhealthyCount, results },
      };
    },
  },
  {
    name: 'commandarr_stack_summary',
    integration: '_system',
    description:
      'Get a complete summary of the media stack: active streams, download queues, pending requests, and recent activity across all configured services.',
    parameters: {
      type: 'object',
      properties: {},
    },
    ui: { category: 'System', dangerLevel: 'low', testable: true },
    handler: async (_params, _ctx) => {
      const registry = await import('../integrations/registry');
      const integrations = registry.getIntegrations();
      const healthy = integrations.filter((i) => i.status === 'healthy');

      if (healthy.length === 0) {
        return {
          success: true,
          message: 'No healthy integrations available to summarize.',
          data: { sections: [] },
        };
      }

      const sections: Array<{ integration: string; category: string; data: unknown; error?: string }> = [];

      // Mapping of integration IDs to summary tools to call
      const summaryToolMap: Record<string, string[]> = {
        plex: ['plex_now_playing'],
        jellyfin: ['jellyfin_now_playing'],
        radarr: ['radarr_queue'],
        sonarr: ['sonarr_queue'],
        lidarr: ['lidarr_queue'],
        sabnzbd: ['sabnzbd_status'],
        qbittorrent: ['qbittorrent_status'],
        overseerr: ['seerr_requests'],
        jellyseerr: ['seerr_requests'],
      };

      for (const integration of healthy) {
        const toolNames = summaryToolMap[integration.manifest.id];
        if (!toolNames) continue;

        for (const toolName of toolNames) {
          const tool = integration.tools.find((t) => t.name === toolName);
          if (!tool) continue;

          try {
            const creds = await registry.getCredentials(integration.manifest.id);
            if (!creds) continue;

            const client = integration.createClient(creds);
            const toolCtx: ToolContext = {
              getClient() { return client; },
              log(msg) { logger.info('integration', `[stack_summary:${integration.manifest.id}] ${msg}`); },
            };

            const result = await tool.handler({}, toolCtx);
            sections.push({
              integration: integration.manifest.name,
              category: tool.ui.category,
              data: result.data ?? result.message,
            });
          } catch (err) {
            sections.push({
              integration: integration.manifest.name,
              category: tool.ui.category,
              data: null,
              error: err instanceof Error ? err.message : 'Failed to fetch',
            });
          }
        }
      }

      const sectionSummaries = sections.map(
        (s) => `${s.integration} (${s.category})${s.error ? ': error' : ': ok'}`,
      );

      return {
        success: true,
        message: `Stack summary from ${sections.length} source(s): ${sectionSummaries.join(', ')}`,
        data: { sections },
      };
    },
  },
  {
    name: 'commandarr_create_automation',
    integration: '_system',
    description:
      'Create a scheduled automation from a natural language description. The user describes when and what should happen, and this tool sets it up. Examples: "Every morning, check if anything downloaded overnight and send me a summary", "Every 5 minutes, check if Plex is up"',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Short name for the automation (e.g., "Morning download summary")',
        },
        schedule: {
          type: 'string',
          description:
            'Natural language schedule (e.g., "every morning at 9", "every 5 minutes", "daily")',
        },
        prompt: {
          type: 'string',
          description:
            'What the agent should do when the automation runs. Be specific about which tools to use and what to report.',
        },
        notifyTelegram: {
          type: 'boolean',
          description: 'Whether to send the result via Telegram (requires Telegram to be configured)',
        },
      },
      required: ['name', 'schedule', 'prompt'],
    },
    ui: { category: 'Automations', dangerLevel: 'medium', testable: false },
    handler: async (params) => {
      const { parseNaturalSchedule } = await import('../scheduler/nl-parser');
      const { nanoid } = await import('nanoid');
      const { getDb } = await import('../db/index');
      const { automations } = await import('../db/schema');
      const { scheduleAutomation } = await import('../scheduler/cron');

      const parsed = parseNaturalSchedule(params.schedule);
      if (!parsed) {
        return {
          success: false,
          message: `Could not parse schedule: "${params.schedule}". Try something like "every morning at 9", "every 5 minutes", "daily", "every weekday at 8am".`,
        };
      }

      const id = nanoid();
      const db = await getDb();

      const notification = params.notifyTelegram
        ? JSON.stringify({ platform: 'telegram', chatId: 'default' })
        : null;

      await db.insert(automations).values({
        id,
        name: params.name,
        enabled: true,
        schedule: parsed.cron,
        prompt: params.prompt,
        conditions: null,
        notification,
        createdAt: new Date(),
      });

      scheduleAutomation(id, parsed.cron, params.prompt, null, notification);

      return {
        success: true,
        message: `Automation "${params.name}" created!\nSchedule: ${parsed.description} (${parsed.cron})\nPrompt: ${params.prompt}`,
        data: { id, name: params.name, cron: parsed.cron, description: parsed.description },
      };
    },
  },
  {
    name: 'commandarr_list_automations',
    integration: '_system',
    description: 'List all scheduled automations with their status, schedule, and last run info.',
    parameters: { type: 'object', properties: {} },
    ui: { category: 'Automations', dangerLevel: 'low', testable: true },
    handler: async () => {
      const { getDb } = await import('../db/index');
      const { automations } = await import('../db/schema');
      const { getNextRun } = await import('../scheduler/cron');
      const { desc } = await import('drizzle-orm');

      const db = await getDb();
      const all = await db.select().from(automations).orderBy(desc(automations.createdAt));

      if (all.length === 0) {
        return { success: true, message: 'No automations configured yet.', data: [] };
      }

      const items = all.map((a) => ({
        id: a.id,
        name: a.name,
        enabled: a.enabled,
        schedule: a.schedule,
        prompt: a.prompt?.slice(0, 100),
        lastRun: a.lastRun?.toISOString(),
        lastResult: a.lastResult?.slice(0, 100),
        nextRun: getNextRun(a.id)?.toISOString(),
      }));

      const summary = items
        .map(
          (a) =>
            `- ${a.name}: ${a.enabled ? 'enabled' : 'DISABLED'} (${a.schedule})${a.nextRun ? ` — next: ${new Date(a.nextRun).toLocaleString()}` : ''}`,
        )
        .join('\n');

      return {
        success: true,
        message: `${items.length} automation(s):\n${summary}`,
        data: items,
      };
    },
  },
  {
    name: 'commandarr_toggle_automation',
    integration: '_system',
    description: 'Enable or disable a scheduled automation by its ID or name.',
    parameters: {
      type: 'object',
      properties: {
        automationId: { type: 'string', description: 'The automation ID or name' },
        enabled: {
          type: 'boolean',
          description: 'Whether to enable (true) or disable (false) the automation',
        },
      },
      required: ['automationId', 'enabled'],
    },
    ui: { category: 'Automations', dangerLevel: 'medium', testable: false },
    handler: async (params) => {
      const { getDb } = await import('../db/index');
      const { automations } = await import('../db/schema');
      const { scheduleAutomation, unscheduleAutomation } = await import('../scheduler/cron');
      const { eq, like } = await import('drizzle-orm');

      const db = await getDb();

      // Try to find by ID first, then by name
      let [auto] = await db
        .select()
        .from(automations)
        .where(eq(automations.id, params.automationId));
      if (!auto) {
        const byName = await db
          .select()
          .from(automations)
          .where(like(automations.name, `%${params.automationId}%`));
        if (byName.length === 1) auto = byName[0];
        else if (byName.length > 1) {
          return {
            success: false,
            message: `Multiple automations match "${params.automationId}". Please use the exact ID.`,
          };
        }
      }

      if (!auto) {
        return {
          success: false,
          message: `Automation "${params.automationId}" not found. Use commandarr_list_automations to see all.`,
        };
      }

      await db
        .update(automations)
        .set({ enabled: params.enabled })
        .where(eq(automations.id, auto.id));

      if (params.enabled) {
        scheduleAutomation(auto.id, auto.schedule, auto.prompt, auto.conditions, auto.notification);
      } else {
        unscheduleAutomation(auto.id);
      }

      return {
        success: true,
        message: `Automation "${auto.name}" ${params.enabled ? 'enabled' : 'disabled'}.`,
      };
    },
  },
];

/**
 * Registry accessor - dynamically import to avoid circular deps.
 * The registry module must export getLoadedIntegrations().
 */
async function getRegistry() {
  const registry = await import('../integrations/registry');
  return registry;
}

/**
 * Execute a tool by name with the given parameters.
 * Looks up the tool in the integration registry, runs its handler,
 * and logs the execution to the audit log.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, any>,
): Promise<ToolResult> {
  const startTime = Date.now();
  logger.info('agent', `Executing tool: ${toolName}`, params);

  try {
    // Check built-in tools first
    const builtIn = builtInTools.find(t => t.name === toolName);
    if (builtIn) {
      const dummyCtx: ToolContext = {
        getClient() { throw new Error('Built-in tools do not have integration clients'); },
        log(msg) { logger.info('agent', `[${toolName}] ${msg}`); },
      };
      const result = await builtIn.handler(params, dummyCtx);
      await logToolExecution(toolName, '_system', params, result, Date.now() - startTime);
      return result;
    }

    const registry = await getRegistry();
    const integrations = registry.getIntegrations();

    // Find the tool across all loaded integrations
    let matchedTool: ToolDefinition | null = null;
    let matchedIntegrationId: string | null = null;
    let matchedClient: IntegrationClient | null = null;

    for (const integration of integrations) {
      // Allow tools from configured (not just healthy) integrations
      if (integration.status === 'unconfigured') continue;

      const tool = integration.tools.find((t) => t.name === toolName);
      if (tool) {
        matchedTool = tool;
        matchedIntegrationId = integration.manifest.id;

        // Get stored credentials and create a client
        const creds = await registry.getCredentials(integration.manifest.id);
        if (creds) {
          matchedClient = integration.createClient(creds);
        }
        break;
      }
    }

    if (!matchedTool || !matchedIntegrationId) {
      const result: ToolResult = {
        success: false,
        message: `Tool "${toolName}" not found or its integration is not healthy.`,
      };
      await logToolExecution(toolName, null, params, result, Date.now() - startTime);
      return result;
    }

    if (!matchedClient) {
      const result: ToolResult = {
        success: false,
        message: `Integration "${matchedIntegrationId}" has no valid credentials configured.`,
      };
      await logToolExecution(toolName, matchedIntegrationId, params, result, Date.now() - startTime);
      return result;
    }

    // Pre-load clients for all configured integrations to support cross-integration calls
    const clientMap = new Map<string, IntegrationClient>();
    clientMap.set(matchedIntegrationId, matchedClient);

    for (const integration of integrations) {
      if (integration.status === 'unconfigured' || integration.manifest.id === matchedIntegrationId) continue;
      try {
        const creds = await registry.getCredentials(integration.manifest.id);
        if (creds) {
          clientMap.set(integration.manifest.id, integration.createClient(creds));
        }
      } catch {
        // Skip integrations we can't create clients for
      }
    }

    const ctx: ToolContext = {
      getClient(targetId: string): IntegrationClient {
        const client = clientMap.get(targetId);
        if (!client) {
          throw new Error(`Integration "${targetId}" is not available or not configured.`);
        }
        return client;
      },
      log(message: string) {
        logger.info('integration', `[${matchedIntegrationId}] ${message}`);
      },
    };

    const result = await matchedTool.handler(params, ctx);
    await logToolExecution(toolName, matchedIntegrationId, params, result, Date.now() - startTime);

    logger.info('agent', `Tool ${toolName} completed`, {
      success: result.success,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error: any) {
    const result: ToolResult = {
      success: false,
      message: `Tool execution error: ${error.message}`,
    };
    await logToolExecution(toolName, null, params, result, Date.now() - startTime);
    logger.error('agent', `Tool ${toolName} threw an error`, error);
    return result;
  }
}

/**
 * Log a tool execution to the audit_log table.
 */
async function logToolExecution(
  toolName: string,
  integrationId: string | null,
  input: Record<string, any>,
  output: ToolResult,
  durationMs: number,
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLog).values({
      id: nanoid(),
      timestamp: new Date(),
      source: 'agent',
      action: `tool:${toolName}`,
      integration: integrationId,
      input: JSON.stringify(input),
      output: JSON.stringify({ ...output, durationMs }),
      level: output.success ? 'info' : 'warn',
    });
  } catch (err) {
    logger.error('agent', 'Failed to write audit log', err);
  }
}

/**
 * Convert internal ToolDefinition[] to LLM-compatible ToolDef[] format.
 */
export function toolsToLLMFormat(tools: ToolDefinition[]): ToolDef[] {
  const allTools = [...builtInTools, ...tools];
  return allTools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
