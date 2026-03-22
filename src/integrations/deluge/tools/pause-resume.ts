import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'deluge_pause_resume',
  integration: 'deluge',
  description: 'Pause or resume torrents in Deluge',
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
        description: 'Array of torrent hashes to target. Omit to affect all torrents.',
        items: { type: 'string' },
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

    const client = ctx.getClient('deluge');

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const method =
        action === 'pause' ? 'core.pause_torrent' : 'core.resume_torrent';
      ctx.log(`${action === 'pause' ? 'Pausing' : 'Resuming'} ${ids.length} torrent(s)...`);
      await client.post(method, [ids]);

      return {
        success: true,
        message: `Successfully ${action === 'pause' ? 'paused' : 'resumed'} ${ids.length} torrent(s)`,
      };
    }

    // Affect all torrents
    const method =
      action === 'pause' ? 'core.pause_all_torrents' : 'core.resume_all_torrents';
    ctx.log(`${action === 'pause' ? 'Pausing' : 'Resuming'} all torrents...`);
    await client.post(method, []);

    return {
      success: true,
      message: `Successfully ${action === 'pause' ? 'paused' : 'resumed'} all torrents`,
    };
  },
};
