import type { ToolDefinition } from '../../_base';

interface Release {
  name: string;
  filterName: string;
  actionStatus: string;
  timestamp: string;
  indexer: string;
  size: number;
}

export const tool: ToolDefinition = {
  name: 'autobrr_releases',
  integration: 'autobrr',
  description:
    'Get recent Autobrr filter matches and release grabs — shows release name, matched filter, action taken, and timestamp',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Number of releases to return (default: 25)',
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination (default: 0)',
      },
    },
  },
  ui: {
    category: 'Activity',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { limit: 10 },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('autobrr');
    ctx.log('Fetching Autobrr releases...');

    const limit = String(params.limit ?? 25);
    const offset = String(params.offset ?? 0);

    const results = await client.get('/api/release', { limit, offset });

    const data = Array.isArray(results) ? results : results?.data ?? [];

    if (!Array.isArray(data) || data.length === 0) {
      return {
        success: true,
        message: 'No recent releases found',
        data: { releases: [] },
      };
    }

    const releases: Release[] = data.map((r: any) => ({
      name: r.name ?? r.title ?? 'Unknown',
      filterName: r.filter_name ?? r.filterName ?? r.filter ?? 'Unknown',
      actionStatus:
        r.action_status ?? r.actionStatus ?? r.action ?? 'unknown',
      timestamp: r.timestamp ?? r.created_at ?? r.createdAt ?? '',
      indexer: r.indexer ?? 'Unknown',
      size: r.size ?? 0,
    }));

    const summary = releases
      .map(
        (r) =>
          `- ${r.name} — filter: ${r.filterName}, action: ${r.actionStatus}, indexer: ${r.indexer}${r.timestamp ? `, at: ${r.timestamp}` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${releases.length} recent release(s):\n${summary}`,
      data: { releases },
    };
  },
};
