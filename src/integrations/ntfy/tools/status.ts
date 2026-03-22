import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'ntfy_status',
  integration: 'ntfy',
  description:
    'Get ntfy server status — health check and server statistics',
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
    const client = ctx.getClient('ntfy');
    ctx.log('Fetching ntfy server status...');

    const health = await client.get('/v1/health');

    let stats: any = null;
    try {
      stats = await client.get('/v1/stats');
    } catch {
      // Stats endpoint may not be available on all ntfy instances
    }

    const lines = [
      `Health: ${health?.healthy !== false ? 'healthy' : 'unhealthy'}`,
    ];

    if (stats) {
      if (stats.messages != null) lines.push(`Total messages: ${stats.messages}`);
      if (stats.messages_rate != null) lines.push(`Message rate: ${stats.messages_rate}/s`);
      if (stats.topics != null) lines.push(`Active topics: ${stats.topics}`);
      if (stats.subscribers != null) lines.push(`Subscribers: ${stats.subscribers}`);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: { health, stats },
    };
  },
};
