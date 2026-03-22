import type { ToolDefinition } from '../../_base';

interface LatestItem {
  Name: string;
  Type: string;
  ProductionYear?: number;
  Id: string;
  SeriesName?: string;
  DateCreated?: string;
}

export const tool: ToolDefinition = {
  name: 'emby_recently_added',
  integration: 'emby',
  description: 'List recently added media items in Emby',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Number of items to return (default 20)',
      },
    },
  },
  ui: {
    category: 'Library',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const limit = params.limit ?? 20;

    const client = ctx.getClient('emby');
    ctx.log(`Fetching ${limit} recently added items from Emby...`);

    const items: LatestItem[] = await client.get('/Items/Latest', {
      Limit: String(limit),
    });

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: true,
        message: 'No recently added items',
        data: { items: [] },
      };
    }

    const results = items.map((item) => ({
      name: item.SeriesName
        ? `${item.SeriesName} — ${item.Name}`
        : item.Name,
      type: item.Type,
      year: item.ProductionYear,
      id: item.Id,
      dateAdded: item.DateCreated,
    }));

    const summary = results
      .map(
        (r) =>
          `- ${r.name} (${r.type}${r.year ? `, ${r.year}` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${results.length} recently added item(s):\n${summary}`,
      data: { items: results },
    };
  },
};
