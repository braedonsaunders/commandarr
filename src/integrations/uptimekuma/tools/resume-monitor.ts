import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'uptimekuma_resume_monitor',
  integration: 'uptimekuma',
  description: 'Resume a paused Uptime Kuma monitor to restart status checks',
  parameters: {
    type: 'object',
    properties: {
      monitorId: {
        type: 'number',
        description: 'The ID of the monitor to resume',
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
    ctx.log(`Resuming monitor ${monitorId}...`);

    try {
      await client.post(`/api/monitors/${monitorId}/resume`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to resume monitor';
      return {
        success: false,
        message: `Failed to resume monitor ${monitorId}: ${message}`,
      };
    }

    return {
      success: true,
      message: `Monitor ${monitorId} has been resumed and will begin checking the target again.`,
      data: { monitorId, action: 'resumed' },
    };
  },
};
