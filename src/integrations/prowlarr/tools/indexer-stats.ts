import type { ToolDefinition } from '../../_base';

interface IndexerStat {
  indexerName: string;
  numberOfQueries: number;
  numberOfGrabs: number;
  numberOfFailures: number;
  averageResponseTime: number;
}

export const tool: ToolDefinition = {
  name: 'prowlarr_indexer_stats',
  integration: 'prowlarr',
  description: 'Get indexer performance statistics from Prowlarr',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Analytics',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('prowlarr');
    ctx.log('Fetching Prowlarr indexer stats...');

    const response = await client.get('/api/v1/indexerstats');

    const indexers = response?.indexers ?? response ?? [];

    if (!Array.isArray(indexers) || indexers.length === 0) {
      return {
        success: true,
        message: 'No indexer statistics available',
        data: { stats: [] },
      };
    }

    const stats: IndexerStat[] = indexers.map((s: any) => ({
      indexerName: s.indexerName ?? s.name ?? 'Unknown',
      numberOfQueries: s.numberOfQueries ?? 0,
      numberOfGrabs: s.numberOfGrabs ?? 0,
      numberOfFailures: s.numberOfFailures ?? 0,
      averageResponseTime: s.averageResponseTime ?? 0,
    }));

    const summary = stats
      .map(
        (s) =>
          `- ${s.indexerName}: ${s.numberOfQueries} queries, ${s.numberOfGrabs} grabs, ${s.numberOfFailures} failures, avg ${s.averageResponseTime}ms`,
      )
      .join('\n');

    return {
      success: true,
      message: `Stats for ${stats.length} indexer(s):\n${summary}`,
      data: { stats },
    };
  },
};
