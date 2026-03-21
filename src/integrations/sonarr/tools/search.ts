import type { ToolDefinition } from '../../_base';

interface SeriesResult {
  title: string;
  year: number;
  overview: string;
  tvdbId: number;
  imdbId?: string;
  seasonCount: number;
  ratings: { value: number; type: string }[];
  network?: string;
  status?: string;
  runtime?: number;
}

export const tool: ToolDefinition = {
  name: 'sonarr_search',
  integration: 'sonarr',
  description: 'Search for TV series to add to Sonarr',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Search term (series title)',
      },
    },
    required: ['term'],
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'breaking bad' },
  },
  async handler(params, ctx) {
    const { term } = params;
    if (!term || typeof term !== 'string') {
      return { success: false, message: 'Search term is required' };
    }

    const client = ctx.getClient('sonarr');
    ctx.log(`Searching Sonarr for: ${term}`);

    const results: SeriesResult[] = await client.get(
      '/api/v3/series/lookup',
      { term },
    );

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: `No series found for "${term}"`,
        data: { results: [] },
      };
    }

    const series = results.slice(0, 15).map((s) => ({
      title: s.title,
      year: s.year,
      overview: s.overview?.slice(0, 150),
      tvdbId: s.tvdbId,
      imdbId: s.imdbId,
      seasonCount: s.seasonCount ?? 0,
      ratings: s.ratings,
      network: s.network,
      status: s.status,
      runtime: s.runtime,
    }));

    const summary = series
      .map(
        (s) =>
          `- ${s.title} (${s.year}) [TVDB: ${s.tvdbId}] ${s.seasonCount} season(s)${s.network ? `, ${s.network}` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} series for "${term}":\n${summary}`,
      data: { results: series },
    };
  },
};
