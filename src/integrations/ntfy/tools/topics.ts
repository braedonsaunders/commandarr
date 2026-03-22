import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'ntfy_topics',
  integration: 'ntfy',
  description:
    'Show ntfy topic configuration — displays the configured default topic and usage information',
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
    ctx.log('Fetching ntfy topic information...');

    // Verify the server is reachable
    const health = await client.get('/v1/health');

    // ntfy doesn't have a dedicated topics list endpoint for self-hosted,
    // but we can report configuration info and server stats if available
    let stats: any = null;
    try {
      stats = await client.get('/v1/stats');
    } catch {
      // Stats may not be available
    }

    const lines = [
      `Default topic: {defaultTopic}`,
      `Server status: ${health?.healthy !== false ? 'healthy' : 'unhealthy'}`,
    ];

    if (stats?.topics != null) {
      lines.push(`Active topics on server: ${stats.topics}`);
    }

    lines.push('');
    lines.push(
      'To publish to a specific topic, use the "topic" parameter in ntfy_publish.',
    );
    lines.push(
      'To read from a specific topic, use the "topic" parameter in ntfy_recent_messages.',
    );

    return {
      success: true,
      message: lines.join('\n'),
      data: { defaultTopic: '{defaultTopic}', health, stats },
    };
  },
};
