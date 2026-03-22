import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'nzbget_pause_resume',
  integration: 'nzbget',
  description: 'Pause or resume the NZBGet download queue',
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

    const client = ctx.getClient('nzbget');
    const rpcMethod = action === 'pause' ? 'pausedownload' : 'resumedownload';
    ctx.log(`${action === 'pause' ? 'Pausing' : 'Resuming'} NZBGet queue...`);

    const response = await client.get(rpcMethod);
    const result = response.result ?? response;

    if (result !== true) {
      return {
        success: false,
        message: `Failed to ${action} NZBGet queue`,
        data: response,
      };
    }

    return {
      success: true,
      message: `NZBGet queue ${action === 'pause' ? 'paused' : 'resumed'} successfully`,
      data: { action },
    };
  },
};
