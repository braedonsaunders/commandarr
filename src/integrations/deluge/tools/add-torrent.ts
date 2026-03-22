import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'deluge_add_torrent',
  integration: 'deluge',
  description: 'Add a torrent to Deluge via magnet link or URL',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Magnet link or URL of the torrent to add',
      },
      downloadPath: {
        type: 'string',
        description: 'Download directory path (optional, uses Deluge default if omitted)',
      },
    },
    required: ['url'],
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { url, downloadPath } = params;
    if (!url || typeof url !== 'string') {
      return { success: false, message: 'A magnet link or torrent URL is required' };
    }

    const client = ctx.getClient('deluge');
    ctx.log(`Adding torrent: ${url.slice(0, 80)}...`);

    const options: Record<string, unknown> = {};
    if (downloadPath) {
      options.download_location = downloadPath;
    }

    if (url.startsWith('magnet:')) {
      await client.post('core.add_torrent_magnet', [url, options]);
    } else {
      await client.post('core.add_torrent_url', [url, options]);
    }

    return {
      success: true,
      message: `Torrent added successfully${downloadPath ? ` to ${downloadPath}` : ''}`,
    };
  },
};
