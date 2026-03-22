import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'crossseed_search',
  integration: 'crossseed',
  description: 'Trigger a manual cross-seed search to find matches across trackers',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Optional torrent name to search for specific matches. If omitted, searches all tracked torrents.',
      },
    },
  },
  ui: {
    category: 'Seeding',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('crossseed');
    const name = params.name as string | undefined;

    if (name) {
      ctx.log(`Triggering cross-seed search for: ${name}`);
    } else {
      ctx.log('Triggering full cross-seed search...');
    }

    const body: Record<string, unknown> = {};
    if (name) {
      body.name = name;
    }

    const result = await client.post('/api/search', body);

    const message = name
      ? `Cross-seed search triggered for "${name}". Matches will be processed automatically.`
      : 'Full cross-seed search triggered. Matches will be processed automatically.';

    return {
      success: true,
      message,
      data: result,
    };
  },
};
