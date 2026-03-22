import type { ToolDefinition } from '../../_base';

interface JellyfinItem {
  Name: string;
  Type: string;
  ProductionYear?: number;
  Overview?: string;
  Id: string;
  SeriesName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  RunTimeTicks?: number;
}

function ticksToMinutes(ticks: number): number {
  return Math.round(ticks / 600000000);
}

export const tool: ToolDefinition = {
  name: 'jellyfin_search',
  integration: 'jellyfin',
  description: 'Search for media items in the Jellyfin library',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Search term (title or keyword)',
      },
      type: {
        type: 'string',
        description: 'Filter by item type',
        enum: ['Movie', 'Series', 'Episode', 'Audio'],
      },
    },
    required: ['term'],
  },
  ui: {
    category: 'Library',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'inception' },
  },
  async handler(params, ctx) {
    const { term, type } = params;
    if (!term || typeof term !== 'string') {
      return { success: false, message: 'Search term is required' };
    }

    const client = ctx.getClient('jellyfin');
    ctx.log(`Searching Jellyfin for: ${term}`);

    const queryParams: Record<string, string> = {
      SearchTerm: term,
      Recursive: 'true',
      Limit: '20',
    };

    if (type) {
      queryParams.IncludeItemTypes = type;
    }

    const response = await client.get('/Items', queryParams);
    const items: JellyfinItem[] = response.Items ?? [];

    if (items.length === 0) {
      return {
        success: true,
        message: `No results found for "${term}"`,
        data: { results: [] },
      };
    }

    const results = items.map((item) => {
      let label = item.Name;
      if (item.SeriesName) {
        label = `${item.SeriesName} — S${item.ParentIndexNumber ?? '?'}E${item.IndexNumber ?? '?'} ${item.Name}`;
      }

      return {
        name: label,
        type: item.Type,
        year: item.ProductionYear,
        overview: item.Overview?.slice(0, 150),
        id: item.Id,
        runtime: item.RunTimeTicks ? ticksToMinutes(item.RunTimeTicks) : undefined,
      };
    });

    const summary = results
      .map(
        (r) =>
          `- ${r.name} (${r.type}${r.year ? `, ${r.year}` : ''}${r.runtime ? `, ${r.runtime}min` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} result(s) for "${term}":\n${summary}`,
      data: { results },
    };
  },
};
