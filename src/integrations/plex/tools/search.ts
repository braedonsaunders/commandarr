import type { ToolDefinition } from '../../_base';

interface PlexSearchResult {
  title: string;
  type: string;
  year?: string;
  rating?: number;
  summary?: string;
  thumb?: string;
  ratingKey?: string;
}

export const tool: ToolDefinition = {
  name: 'plex_search',
  integration: 'plex',
  description: 'Search for media across all Plex libraries',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query string',
      },
    },
    required: ['query'],
  },
  ui: {
    category: 'Libraries',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { query: 'test' },
  },
  async handler(params, ctx) {
    const { query } = params;
    if (!query || typeof query !== 'string') {
      return { success: false, message: 'Search query is required' };
    }

    const client = ctx.getClient('plex');
    ctx.log(`Searching Plex for: ${query}`);

    const response = await client.get('/search', { query });
    const results: PlexSearchResult[] = [];

    if (response.MediaContainer) {
      const metadata = response.MediaContainer.Metadata ?? [];
      const items = Array.isArray(metadata) ? metadata : [metadata];

      for (const item of items) {
        if (!item) continue;
        results.push({
          title: item.title ?? 'Unknown',
          type: item.type ?? 'unknown',
          year: item.year?.toString(),
          rating: item.rating ? parseFloat(item.rating) : undefined,
          summary: item.summary?.slice(0, 200),
          thumb: item.thumb,
          ratingKey: item.ratingKey,
        });
      }
    } else if (response._xml) {
      const xml = response._xml as string;
      // Match Video, Directory, and other media elements
      const itemRegex = /<(?:Video|Directory|Track|Photo)\s([^>]*)\/?\s*>/gi;
      let match: RegExpExecArray | null;

      while ((match = itemRegex.exec(xml)) !== null) {
        const attrs = match[1]!;
        const getAttr = (name: string) => {
          const r = new RegExp(`${name}="([^"]*)"`, 'i');
          return r.exec(attrs)?.[1];
        };

        results.push({
          title: getAttr('title') ?? 'Unknown',
          type: getAttr('type') ?? 'unknown',
          year: getAttr('year'),
          rating: getAttr('rating') ? parseFloat(getAttr('rating')!) : undefined,
          summary: getAttr('summary')?.slice(0, 200),
          ratingKey: getAttr('ratingKey'),
        });
      }
    }

    if (results.length === 0) {
      return {
        success: true,
        message: `No results found for "${query}"`,
        data: { results: [] },
      };
    }

    const summary = results
      .slice(0, 15)
      .map(
        (r) =>
          `- ${r.title} (${r.type}${r.year ? `, ${r.year}` : ''}${r.rating ? `, ${r.rating}/10` : ''})`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} result(s) for "${query}":\n${summary}`,
      data: { results },
    };
  },
};
