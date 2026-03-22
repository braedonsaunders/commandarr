import type { ToolDefinition } from '../../_base';

interface RecentlyAddedItem {
  title: string;
  type: string;
  year?: string;
  addedAt?: string;
  summary?: string;
  parentTitle?: string;
  grandparentTitle?: string;
}

export const tool: ToolDefinition = {
  name: 'plex_recently_added',
  integration: 'plex',
  description:
    'Get recently added content from Plex libraries. Shows the latest movies, episodes, and other media added to your server.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 20)',
      },
    },
  },
  ui: {
    category: 'Libraries',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const limit = params.limit ?? 20;
    const client = ctx.getClient('plex');

    ctx.log(`Fetching recently added content (limit: ${limit})`);

    const response = await client.get('/library/recentlyAdded', {
      'X-Plex-Container-Start': '0',
      'X-Plex-Container-Size': String(limit),
    });

    const results: RecentlyAddedItem[] = [];

    if (response.MediaContainer) {
      const metadata = response.MediaContainer.Metadata ?? [];
      const items = Array.isArray(metadata) ? metadata : [metadata];

      for (const item of items) {
        if (!item) continue;
        results.push({
          title: item.title ?? 'Unknown',
          type: item.type ?? 'unknown',
          year: item.year?.toString(),
          addedAt: item.addedAt
            ? new Date(Number(item.addedAt) * 1000).toISOString().split('T')[0]
            : undefined,
          summary: item.summary?.slice(0, 150),
          parentTitle: item.parentTitle,
          grandparentTitle: item.grandparentTitle,
        });
      }
    } else if (response._xml) {
      const xml = response._xml as string;
      const itemRegex =
        /<(?:Video|Directory|Track|Photo)\s([^>]*)\/?\s*>/gi;
      let match: RegExpExecArray | null;

      while ((match = itemRegex.exec(xml)) !== null) {
        const attrs = match[1]!;
        const getAttr = (name: string) => {
          const r = new RegExp(`${name}="([^"]*)"`, 'i');
          return r.exec(attrs)?.[1];
        };

        const addedAtRaw = getAttr('addedAt');
        results.push({
          title: getAttr('title') ?? 'Unknown',
          type: getAttr('type') ?? 'unknown',
          year: getAttr('year'),
          addedAt: addedAtRaw
            ? new Date(Number(addedAtRaw) * 1000).toISOString().split('T')[0]
            : undefined,
          summary: getAttr('summary')?.slice(0, 150),
          parentTitle: getAttr('parentTitle'),
          grandparentTitle: getAttr('grandparentTitle'),
        });
      }
    }

    if (results.length === 0) {
      return {
        success: true,
        message: 'No recently added content found.',
        data: { results: [] },
      };
    }

    const summary = results
      .slice(0, limit)
      .map((r) => {
        let label = `- ${r.title}`;
        if (r.grandparentTitle) {
          label = `- ${r.grandparentTitle} — ${r.parentTitle ? `${r.parentTitle} — ` : ''}${r.title}`;
        }
        label += ` (${r.type}${r.year ? `, ${r.year}` : ''})`;
        if (r.addedAt) label += ` [added ${r.addedAt}]`;
        return label;
      })
      .join('\n');

    return {
      success: true,
      message: `Recently added (${results.length} item${results.length !== 1 ? 's' : ''}):\n${summary}`,
      data: { results },
    };
  },
};
