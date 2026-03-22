import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'qbittorrent_add_torrent',
  integration: 'qbittorrent',
  description: 'Add a torrent to qBittorrent via magnet link or URL',
  parameters: {
    type: 'object',
    properties: {
      urls: {
        type: 'string',
        description: 'Magnet link or URL of the torrent to add',
      },
      category: {
        type: 'string',
        description: 'Category to assign to the torrent (optional)',
      },
    },
    required: ['urls'],
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { urls, category } = params;
    if (!urls || typeof urls !== 'string') {
      return { success: false, message: 'A magnet link or torrent URL is required' };
    }

    const client = ctx.getClient('qbittorrent');
    ctx.log(`Adding torrent: ${urls.slice(0, 80)}...`);

    let body = `urls=${encodeURIComponent(urls)}`;
    if (category) {
      body += `&category=${encodeURIComponent(category)}`;
    }

    await client.post('/api/v2/torrents/add', body);

    return {
      success: true,
      message: `Torrent added successfully${category ? ` to category "${category}"` : ''}`,
    };
  },
};
