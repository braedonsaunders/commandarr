import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'transmission_pause_resume',
  integration: 'transmission',
  description: 'Pause or resume torrents in Transmission',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Whether to pause or resume torrents',
        enum: ['pause', 'resume'],
      },
      ids: {
        type: 'array',
        description: 'Array of torrent IDs to target. Omit to affect all torrents.',
        items: { type: 'number' },
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
    const { action, ids } = params;
    if (action !== 'pause' && action !== 'resume') {
      return { success: false, message: 'Action must be "pause" or "resume"' };
    }

    const client = ctx.getClient('transmission');
    const method = action === 'pause' ? 'torrent-stop' : 'torrent-start';
    const args: Record<string, unknown> = {};

    if (ids && Array.isArray(ids) && ids.length > 0) {
      args.ids = ids;
    }

    const target = ids && ids.length > 0 ? `torrent(s) ${ids.join(', ')}` : 'all torrents';
    ctx.log(`${action === 'pause' ? 'Pausing' : 'Resuming'} ${target}...`);

    await client.post(method, args);

    return {
      success: true,
      message: `Successfully ${action === 'pause' ? 'paused' : 'resumed'} ${target}`,
    };
  },
};
