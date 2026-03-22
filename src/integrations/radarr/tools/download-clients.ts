import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_download_clients',
  integration: 'radarr',
  description:
    'List all download clients configured in Radarr with their status and settings.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('radarr');
    ctx.log('Fetching Radarr download clients...');

    const clients: any[] = await client.get('/api/v3/downloadclient');

    if (!Array.isArray(clients) || clients.length === 0) {
      return {
        success: true,
        message: 'No download clients configured in Radarr.',
        data: { downloadClients: [] },
      };
    }

    const formatted = clients.map((dc: any) => ({
      id: dc.id,
      name: dc.name ?? 'Unknown',
      implementation: dc.implementation ?? 'Unknown',
      protocol: dc.protocol ?? 'unknown',
      enabled: dc.enable ?? false,
      priority: dc.priority ?? 1,
      removeCompletedDownloads: dc.removeCompletedDownloads ?? false,
      removeFailedDownloads: dc.removeFailedDownloads ?? false,
      tags: dc.tags ?? [],
    }));

    const lines = formatted.map(
      (dc) =>
        `- ${dc.name} (ID: ${dc.id}) [${dc.implementation}/${dc.protocol}] — ` +
        `${dc.enabled ? 'Enabled' : 'Disabled'}, Priority: ${dc.priority}`,
    );

    return {
      success: true,
      message: `${formatted.length} download client(s):\n${lines.join('\n')}`,
      data: { downloadClients: formatted },
    };
  },
};
