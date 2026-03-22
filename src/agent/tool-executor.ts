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
    description: 'Create a dashboard widget from a description. The widget will be generated as HTML/CSS/JS and saved to the dashboard. Use this when the user asks to create, make, or build a widget.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Description of the widget to create (e.g., "show Plex library sizes as a bar chart")',
        },
        name: {
          type: 'string',
          description: 'Short name for the widget',
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
          message: `Widget "${widget.name}" created and added to your dashboard.`,
          data: { id: widget.id, name: widget.name },
        };
      } catch (e) {
        return {
          success: false,
          message: `Failed to create widget: ${e instanceof Error ? e.message : 'Unknown error'}`,
        };
      }
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
 * Build a ToolContext for executing a tool within an integration.
 */
function buildToolContext(integrationId: string): ToolContext {
  return {
    getClient(targetIntegrationId: string): IntegrationClient {
      // Placeholder - integration clients are resolved at execution time.
      // The real client comes from the registry's loaded integrations.
      throw new Error(
        `Cannot get client for "${targetIntegrationId}" - use the registry directly. This context method is for cross-integration calls.`,
      );
    },
    log(message: string) {
      logger.info('integration', `[${integrationId}] ${message}`);
    },
  };
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

    // Build context with a working getClient that resolves the matched client
    const ctx: ToolContext = {
      getClient(targetId: string): IntegrationClient {
        if (targetId === matchedIntegrationId) {
          return matchedClient!;
        }
        // For cross-integration calls, try to resolve from registry
        const targetIntegration = integrations.find(
          (i) => i.manifest.id === targetId && i.status === 'healthy',
        );
        if (!targetIntegration) {
          throw new Error(`Integration "${targetId}" is not available.`);
        }
        // This is a simplified cross-integration call - real credentials would need to be fetched
        throw new Error(
          `Cross-integration client for "${targetId}" is not supported in this context.`,
        );
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
