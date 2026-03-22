import type { ToolDefinition } from '../../_base';

interface Indexer {
  name: string;
  protocol: string;
  enabled: boolean;
  priority: number;
  status: string;
  id: number;
}

export const tool: ToolDefinition = {
  name: 'prowlarr_indexers',
  integration: 'prowlarr',
  description: 'List all configured indexers in Prowlarr',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Indexers',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('prowlarr');
    ctx.log('Fetching Prowlarr indexers...');

    const results = await client.get('/api/v1/indexer');

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No indexers configured',
        data: { indexers: [] },
      };
    }

    const indexers: Indexer[] = results.map((i: any) => ({
      id: i.id,
      name: i.name ?? 'Unknown',
      protocol: i.protocol ?? 'unknown',
      enabled: i.enable ?? false,
      priority: i.priority ?? 25,
      status: i.enable ? 'enabled' : 'disabled',
    }));

    const summary = indexers
      .map(
        (i) =>
          `- ${i.name} (ID: ${i.id}, ${i.protocol}, priority: ${i.priority}, ${i.status})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${indexers.length} indexer(s) configured:\n${summary}`,
      data: { indexers },
    };
  },
};
