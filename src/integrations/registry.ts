import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../db/index';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import type {
  IntegrationManifest,
  IntegrationClient,
  ToolDefinition,
  ToolContext,
  ToolResult,
  LoadedIntegration,
} from './_base';

const integrations = new Map<string, LoadedIntegration>();
const toolIndex = new Map<string, ToolDefinition>();

export async function initRegistry(): Promise<void> {
  const integrationsDir = join(import.meta.dir, '.');
  const entries = await readdir(integrationsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

    const integrationDir = join(integrationsDir, entry.name);

    try {
      const manifestModule = await import(join(integrationDir, 'manifest.ts'));
      const manifest: IntegrationManifest = manifestModule.manifest;

      const clientModule = await import(join(integrationDir, 'client.ts'));
      const createClient = clientModule.createClient as (
        creds: Record<string, string>,
      ) => IntegrationClient;

      const tools: ToolDefinition[] = [];
      const toolsDir = join(integrationDir, 'tools');

      try {
        const toolFiles = await readdir(toolsDir);
        for (const toolFile of toolFiles) {
          if (!toolFile.endsWith('.ts')) continue;
          const toolModule = await import(join(toolsDir, toolFile));
          if (toolModule.tool) {
            tools.push(toolModule.tool);
            toolIndex.set(toolModule.tool.name, toolModule.tool);
          }
        }
      } catch {
        // No tools directory or empty
      }

      const creds = await getCredentials(manifest.id);
      const status = creds ? 'configured' : 'unconfigured';

      integrations.set(manifest.id, { id: manifest.id, manifest, tools, createClient, status });
      logger.info(
        'integration',
        `Loaded integration: ${manifest.name} (${tools.length} tools)`,
      );
    } catch (err) {
      logger.error(
        'integration',
        `Failed to load integration from ${entry.name}`,
        err,
      );
    }
  }

  logger.info(
    'integration',
    `Registry initialized: ${integrations.size} integrations, ${toolIndex.size} tools`,
  );

  // Run health checks for all configured integrations
  const configured = Array.from(integrations.values()).filter(i => i.status !== 'unconfigured');
  if (configured.length > 0) {
    logger.info('integration', `Running startup health checks for ${configured.length} configured integration(s)...`);
    await Promise.allSettled(
      configured.map(async (integration) => {
        try {
          const result = await healthCheck(integration.id);
          logger.info('integration', `${integration.manifest.name}: ${result.healthy ? 'healthy' : 'unhealthy'}`);
        } catch {
          logger.warn('integration', `${integration.manifest.name}: health check failed`);
        }
      }),
    );
  }
}

export function getIntegrations(): LoadedIntegration[] {
  return Array.from(integrations.values());
}

export function getIntegration(id: string): LoadedIntegration | undefined {
  return integrations.get(id);
}

export function getTools(integrationId?: string): ToolDefinition[] {
  if (integrationId) {
    const integration = integrations.get(integrationId);
    return integration?.tools ?? [];
  }
  return Array.from(toolIndex.values());
}

export async function executeTool(
  toolName: string,
  params: Record<string, any>,
): Promise<ToolResult> {
  const tool = toolIndex.get(toolName);
  if (!tool) {
    return { success: false, message: `Unknown tool: ${toolName}` };
  }

  const ctx: ToolContext = {
    getClient(integrationId: string): IntegrationClient {
      return createClient(integrationId);
    },
    log(message: string) {
      logger.info('integration', `[${toolName}] ${message}`);
    },
  };

  try {
    logger.info('integration', `Executing tool: ${toolName}`, params);
    const result = await tool.handler(params, ctx);
    logger.info('integration', `Tool ${toolName} completed`, {
      success: result.success,
    });
    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error occurred';
    logger.error('integration', `Tool ${toolName} failed: ${message}`, err);
    return { success: false, message };
  }
}

export async function healthCheck(
  integrationId: string,
): Promise<{ healthy: boolean; message: string; data?: unknown }> {
  const integration = integrations.get(integrationId);
  if (!integration) {
    return { healthy: false, message: `Unknown integration: ${integrationId}` };
  }

  const creds = await getCredentials(integrationId);
  if (!creds) {
    return {
      healthy: false,
      message: `No credentials configured for ${integration.manifest.name}`,
    };
  }

  try {
    const client = integration.createClient(creds);
    const { endpoint, timeout } = integration.manifest.healthCheck;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout * 1000);

    try {
      const data = await client.get(endpoint);
      clearTimeout(timer);

      // Update status in DB
      const db = await getDb();
      await db
        .update(schema.integrationCredentials)
        .set({
          lastHealthCheck: new Date(),
          lastHealthStatus: 'healthy',
        })
        .where(eq(schema.integrationCredentials.id, integrationId));

      integration.status = 'healthy';
      return { healthy: true, message: 'Connection successful', data };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Health check failed';

    try {
      const db = await getDb();
      await db
        .update(schema.integrationCredentials)
        .set({
          lastHealthCheck: new Date(),
          lastHealthStatus: 'unhealthy',
        })
        .where(eq(schema.integrationCredentials.id, integrationId));
    } catch {
      // DB update failed, non-critical
    }

    integration.status = 'unhealthy';
    return { healthy: false, message };
  }
}

export async function getCredentials(
  integrationId: string,
): Promise<Record<string, string> | null> {
  try {
    const db = await getDb();
    const row = await db
      .select()
      .from(schema.integrationCredentials)
      .where(eq(schema.integrationCredentials.id, integrationId))
      .get();

    if (!row?.credentials) return null;

    const decrypted = decrypt(row.credentials);
    return JSON.parse(decrypted) as Record<string, string>;
  } catch (err) {
    logger.error(
      'integration',
      `Failed to get credentials for ${integrationId}`,
      err,
    );
    return null;
  }
}

export async function saveCredentials(
  integrationId: string,
  creds: Record<string, string>,
): Promise<void> {
  const db = await getDb();
  const encrypted = encrypt(JSON.stringify(creds));
  const now = new Date();

  const existing = await db
    .select()
    .from(schema.integrationCredentials)
    .where(eq(schema.integrationCredentials.id, integrationId))
    .get();

  if (existing) {
    await db
      .update(schema.integrationCredentials)
      .set({
        credentials: encrypted,
        updatedAt: now,
      })
      .where(eq(schema.integrationCredentials.id, integrationId));
  } else {
    await db.insert(schema.integrationCredentials).values({
      id: integrationId,
      credentials: encrypted,
      enabled: true,
      lastHealthStatus: 'unknown',
      createdAt: now,
      updatedAt: now,
    });
  }

  const integration = integrations.get(integrationId);
  if (integration) {
    integration.status = 'configured';
  }

  logger.info(
    'integration',
    `Credentials saved for ${integrationId}`,
  );
}

export function createClient(integrationId: string): IntegrationClient {
  const integration = integrations.get(integrationId);
  if (!integration) {
    throw new Error(`Unknown integration: ${integrationId}`);
  }

  // We need credentials synchronously for the client, so we build a lazy client
  // that fetches creds on first use
  let cachedClient: IntegrationClient | null = null;
  let credsPromise: Promise<Record<string, string> | null> | null = null;

  const ensureClient = async (): Promise<IntegrationClient> => {
    if (cachedClient) return cachedClient;

    if (!credsPromise) {
      credsPromise = getCredentials(integrationId);
    }

    const creds = await credsPromise;
    if (!creds) {
      throw new Error(
        `No credentials configured for ${integration.manifest.name}`,
      );
    }

    cachedClient = integration.createClient(creds);
    return cachedClient;
  };

  return {
    async get(path, params) {
      const client = await ensureClient();
      return client.get(path, params);
    },
    async post(path, body) {
      const client = await ensureClient();
      return client.post(path, body);
    },
    async put(path, body) {
      const client = await ensureClient();
      return client.put(path, body);
    },
    async delete(path) {
      const client = await ensureClient();
      return client.delete(path);
    },
  };
}
