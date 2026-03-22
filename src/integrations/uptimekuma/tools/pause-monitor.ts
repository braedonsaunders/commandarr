import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'uptimekuma_pause_monitor',
  integration: 'uptimekuma',
  description: 'Pause an Uptime Kuma monitor to temporarily stop checking its status',
  parameters: {
    type: 'object',
    properties: {
      monitorId: {
        type: 'number',
        description: 'The ID of the monitor to pause',
      },
    },
    required: ['monitorId'],
  },
  ui: {
    category: 'Monitoring',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        message: 'monitorId is required',
      };
    }

    const client = ctx.getClient('uptimekuma');
    ctx.log(`Pausing monitor ${monitorId}...`);

    try {
      await client.post(`/api/monitors/${monitorId}/pause`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to pause monitor';
      return {
        success: false,
        message: `Failed to pause monitor ${monitorId}: ${message}`,
      };
    }

    return {
      success: true,
      message: `Monitor ${monitorId} has been paused. It will no longer check the target until resumed.`,
      data: { monitorId, action: 'paused' },
    };
  },
};
