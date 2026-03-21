import type { ToolDefinition, ToolResult, ToolContext, IntegrationClient } from '../integrations/_base';
import type { ToolDef } from '../llm/provider';
import { getDb } from '../db/index';
import { auditLog } from '../db/schema';
import { logger } from '../utils/logger';
import { nanoid } from 'nanoid';

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
    const registry = await getRegistry();
    const integrations = registry.getIntegrations();

    // Find the tool across all loaded integrations
    let matchedTool: ToolDefinition | null = null;
    let matchedIntegrationId: string | null = null;
    let matchedClient: IntegrationClient | null = null;

    for (const integration of integrations) {
      if (integration.status !== 'healthy') continue;

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
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
