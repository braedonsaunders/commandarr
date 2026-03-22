import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'crossseed_webhook',
  integration: 'crossseed',
  description:
    'Notify Cross-seed of a new download to check for cross-seed matches (used by autobrr integration)',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Torrent name to check for cross-seed matches',
      },
      infoHash: {
        type: 'string',
        description: 'Optional info hash of the torrent',
      },
      path: {
        type: 'string',
        description: 'Optional download path of the torrent data',
      },
    },
    required: ['name'],
  },
  ui: {
    category: 'Seeding',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('crossseed');
    const name = params.name as string;
    const infoHash = params.infoHash as string | undefined;
    const path = params.path as string | undefined;

    ctx.log(`Sending webhook to Cross-seed for: ${name}`);

    const body: Record<string, unknown> = { name };
    if (infoHash) body.infoHash = infoHash;
    if (path) body.path = path;

    const result = await client.post('/api/webhook', body);

    return {
      success: true,
      message: `Cross-seed webhook sent for "${name}". Cross-seed will check for matching torrents across trackers.`,
      data: result,
    };
  },
};
