import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_indexers',
  integration: 'sonarr',
  description:
    'List all indexers configured in Sonarr with their status, priority, and settings. Shows which indexers are enabled, their protocol (usenet/torrent), and any RSS/search capabilities.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('sonarr');
    ctx.log('Fetching Sonarr indexers...');

    const indexers: any[] = await client.get('/api/v3/indexer');

    if (!Array.isArray(indexers) || indexers.length === 0) {
      return {
        success: true,
        message: 'No indexers configured in Sonarr.',
        data: { indexers: [] },
      };
    }

    const formatted = indexers.map((idx: any) => ({
      id: idx.id,
      name: idx.name ?? 'Unknown',
      protocol: idx.protocol ?? 'unknown',
      implementation: idx.implementation ?? 'Unknown',
      enabled: idx.enableRss || idx.enableAutomaticSearch || idx.enableInteractiveSearch,
      enableRss: idx.enableRss ?? false,
      enableAutomaticSearch: idx.enableAutomaticSearch ?? false,
      enableInteractiveSearch: idx.enableInteractiveSearch ?? false,
      priority: idx.priority ?? 25,
      seasonSearchMaximumSingleEpisodeAge: idx.seasonSearchMaximumSingleEpisodeAge,
      tags: idx.tags ?? [],
    }));

    const lines = formatted.map(
      (idx) =>
        `- ${idx.name} (ID: ${idx.id}) [${idx.protocol}] — ` +
        `RSS: ${idx.enableRss ? 'on' : 'off'}, ` +
        `Auto: ${idx.enableAutomaticSearch ? 'on' : 'off'}, ` +
        `Interactive: ${idx.enableInteractiveSearch ? 'on' : 'off'}, ` +
        `Priority: ${idx.priority}`,
    );

    return {
      success: true,
      message: `${formatted.length} indexer(s):\n${lines.join('\n')}`,
      data: { indexers: formatted },
    };
  },
};
