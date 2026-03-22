import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'qbittorrent_pause_resume',
  integration: 'qbittorrent',
  description: 'Pause or resume torrents in qBittorrent',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Whether to pause or resume torrents',
        enum: ['pause', 'resume'],
      },
      hash: {
        type: 'string',
        description: 'Torrent hash to target, or "all" to affect all torrents. Defaults to "all".',
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

    const hash = params.hash ?? 'all';
    const client = ctx.getClient('qbittorrent');
    const endpoint = action === 'pause' ? '/api/v2/torrents/pause' : '/api/v2/torrents/resume';

    ctx.log(`${action === 'pause' ? 'Pausing' : 'Resuming'} torrent(s): ${hash}`);

    await client.post(endpoint, `hashes=${encodeURIComponent(hash)}`);

    const target = hash === 'all' ? 'all torrents' : `torrent ${hash}`;
    return {
      success: true,
      message: `Successfully ${action === 'pause' ? 'paused' : 'resumed'} ${target}`,
    };
  },
};
