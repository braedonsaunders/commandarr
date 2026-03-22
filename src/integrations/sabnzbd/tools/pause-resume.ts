import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sabnzbd_pause_resume',
  integration: 'sabnzbd',
  description: 'Pause or resume the SABnzbd download queue',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Action to perform: "pause" or "resume"',
        enum: ['pause', 'resume'],
      },
    },
    required: ['action'],
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { action } = params;
    if (action !== 'pause' && action !== 'resume') {
      return { success: false, message: 'Action must be "pause" or "resume"' };
    }

    const client = ctx.getClient('sabnzbd');
    ctx.log(`${action === 'pause' ? 'Pausing' : 'Resuming'} SABnzbd queue...`);

    await client.get(`/api?mode=${action}`);

    return {
      success: true,
      message: `SABnzbd queue ${action === 'pause' ? 'paused' : 'resumed'} successfully`,
      data: { action },
    };
  },
};
