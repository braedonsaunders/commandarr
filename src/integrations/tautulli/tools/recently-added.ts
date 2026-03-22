import type { ToolDefinition } from '../../_base';

interface RecentlyAddedItem {
  title: string;
  year: number | null;
  addedAt: string;
  library: string;
  mediaType: string;
  parentTitle?: string;
}

export const tool: ToolDefinition = {
  name: 'tautulli_recently_added',
  integration: 'tautulli',
  description: 'View recently added media to Plex libraries',
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Number of recently added items to retrieve (default: 20)',
      },
    },
  },
  ui: {
    category: 'Library',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('tautulli');
    const count = String(params.count ?? 20);

    ctx.log('Fetching recently added media...');

    const data = await client.get('get_recently_added', { count });

    const records = data?.recently_added ?? [];
    const items: RecentlyAddedItem[] = [];

    if (Array.isArray(records)) {
      for (const r of records) {
        items.push({
          title: r.title ?? 'Unknown',
          year: r.year ? Number(r.year) : null,
          addedAt: r.added_at
            ? new Date(Number(r.added_at) * 1000).toLocaleString()
            : 'Unknown',
          library: r.library_name ?? 'Unknown',
          mediaType: r.media_type ?? 'unknown',
          parentTitle: r.parent_title ?? undefined,
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'No recently added media found',
        data: { items: [] },
      };
    }

    const summary = items
      .map(
        (item) =>
          `- ${item.title}${item.year ? ` (${item.year})` : ''} | ${item.library} | ${item.mediaType} | Added: ${item.addedAt}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} recently added item(s):\n${summary}`,
      data: { items },
    };
  },
};
