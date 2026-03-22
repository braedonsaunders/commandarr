import type { ToolDefinition } from '../../_base';

interface TrendingResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  mediaType: string;
}

function getYear(result: TrendingResult): string {
  const date = result.releaseDate ?? result.firstAirDate;
  if (!date) return 'N/A';
  return date.slice(0, 4);
}

export const tool: ToolDefinition = {
  name: 'seerr_trending',
  integration: 'seerr',
  description: 'Get trending movies and TV shows from Seerr',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Discovery',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('seerr');
    ctx.log('Fetching trending media from Seerr...');

    const response = await client.get('/api/v1/discover/trending');

    const results: TrendingResult[] = response.results ?? response ?? [];

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No trending items found.',
        data: { results: [] },
      };
    }

    const items = results.slice(0, 20).map((r) => ({
      id: r.id,
      title: r.title ?? r.name ?? 'Unknown',
      type: r.mediaType,
      year: getYear(r),
      overview: r.overview?.slice(0, 150),
    }));

    const summary = items
      .map((r) => `- ${r.title} (${r.year}) [${r.type}]`)
      .join('\n');

    return {
      success: true,
      message: `${items.length} trending item(s):\n${summary}`,
      data: { results: items },
    };
  },
};
