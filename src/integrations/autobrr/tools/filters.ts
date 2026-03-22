import type { ToolDefinition } from '../../_base';

interface Filter {
  id: number;
  name: string;
  enabled: boolean;
  matchCount: number;
  lastMatchTime: string | null;
}

export const tool: ToolDefinition = {
  name: 'autobrr_filters',
  integration: 'autobrr',
  description:
    'List all Autobrr filters with their enabled status, match count, and last match time',
  parameters: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description:
          'Filter by enabled/disabled status. Omit to show all filters.',
      },
    },
  },
  ui: {
    category: 'Automation',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('autobrr');
    ctx.log('Fetching Autobrr filters...');

    const results = await client.get('/api/filters');

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No filters configured',
        data: { filters: [] },
      };
    }

    let filters: Filter[] = results.map((f: any) => ({
      id: f.id,
      name: f.name ?? 'Unknown',
      enabled: f.enabled ?? false,
      matchCount: f.match_count ?? f.matchCount ?? 0,
      lastMatchTime: f.last_match_time ?? f.lastMatchTime ?? null,
    }));

    if (params.enabled !== undefined) {
      filters = filters.filter((f) => f.enabled === params.enabled);
    }

    const summary = filters
      .map(
        (f) =>
          `- ${f.name} (ID: ${f.id}, ${f.enabled ? 'enabled' : 'disabled'}, ${f.matchCount} matches${f.lastMatchTime ? `, last: ${f.lastMatchTime}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${filters.length} filter(s):\n${summary}`,
      data: { filters },
    };
  },
};
