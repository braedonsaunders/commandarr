import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sabnzbd_speed_limit',
  integration: 'sabnzbd',
  description: 'Set the SABnzbd download speed limit (0 for unlimited)',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Speed limit in KB/s (0 for unlimited)',
      },
    },
    required: ['limit'],
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { limit } = params;
    if (typeof limit !== 'number' || limit < 0) {
      return { success: false, message: 'Speed limit must be a non-negative number in KB/s' };
    }

    const client = ctx.getClient('sabnzbd');
    ctx.log(`Setting SABnzbd speed limit to ${limit === 0 ? 'unlimited' : `${limit} KB/s`}...`);

    await client.get(`/api?mode=config&name=speedlimit&value=${limit}`);

    return {
      success: true,
      message: limit === 0
        ? 'Speed limit removed (unlimited)'
        : `Speed limit set to ${limit} KB/s`,
      data: { limit },
    };
  },
};
