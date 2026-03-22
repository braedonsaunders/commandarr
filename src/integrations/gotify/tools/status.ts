import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gotify_status',
  integration: 'gotify',
  description:
    'Get Gotify server status — health check and version information',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('gotify');
    ctx.log('Fetching Gotify server status...');

    const [health, version] = await Promise.all([
      client.get('/health'),
      client.get('/version'),
    ]);

    const healthStatus =
      typeof health === 'string'
        ? health.toLowerCase().includes('ok')
          ? 'healthy'
          : health
        : health?.health ?? 'healthy';

    const lines = [
      `Health: ${healthStatus}`,
      `Version: ${version?.version ?? version ?? 'Unknown'}`,
      `Build date: ${version?.buildDate ?? 'Unknown'}`,
      `Commit: ${version?.commit ?? 'Unknown'}`,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: { health, version },
    };
  },
};
