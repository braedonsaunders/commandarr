import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'transmission_add_torrent',
  integration: 'transmission',
  description: 'Add a torrent to Transmission via magnet link or .torrent URL',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Magnet link or URL of the .torrent file to add',
      },
      downloadDir: {
        type: 'string',
        description: 'Download directory path (optional, uses default if omitted)',
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
    const { url, downloadDir } = params;
    if (!url || typeof url !== 'string') {
      return { success: false, message: 'A magnet link or torrent URL is required' };
    }

    const client = ctx.getClient('transmission');
    ctx.log(`Adding torrent: ${url.slice(0, 80)}...`);

    const args: Record<string, unknown> = {
      filename: url,
    };

    if (downloadDir) {
      args['download-dir'] = downloadDir;
    }

    const result = await client.post('torrent-add', args);

    const added = result['torrent-added'] ?? result['torrent-duplicate'] ?? null;
    const isDuplicate = !!result['torrent-duplicate'];

    if (added) {
      const name = added.name ?? 'Unknown';
      const suffix = isDuplicate ? ' (already existed)' : '';
      return {
        success: true,
        message: `Torrent added: ${name}${suffix}${downloadDir ? ` to ${downloadDir}` : ''}`,
        data: { id: added.id, name: added.name, hashString: added.hashString },
      };
    }

    return {
      success: true,
      message: `Torrent add request sent${downloadDir ? ` to ${downloadDir}` : ''}`,
    };
  },
};
