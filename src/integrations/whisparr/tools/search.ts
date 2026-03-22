import type { ToolDefinition } from '../../_base';

interface MovieResult {
  title: string;
  year: number;
  overview: string;
  tmdbId: number;
  studio?: string;
  runtime?: number;
  status?: string;
  images?: { coverType: string; remoteUrl: string }[];
}

export const tool: ToolDefinition = {
  name: 'whisparr_search',
  integration: 'whisparr',
  description: 'Search for content to add to Whisparr',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Search term (title)',
      },
    },
    required: ['term'],
  },
  ui: {
    category: 'Media',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'test' },
  },
  async handler(params, ctx) {
    const { term } = params;
    if (!term || typeof term !== 'string') {
      return { success: false, message: 'Search term is required' };
    }

    const client = ctx.getClient('whisparr');
    ctx.log(`Searching Whisparr for: ${term}`);

    const results: MovieResult[] = await client.get(
      `/api/v3/movie/lookup`,
      { term },
    );

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: `No results found for "${term}"`,
        data: { results: [] },
      };
    }

    const movies = results.slice(0, 15).map((m) => ({
      title: m.title,
      year: m.year,
      overview: m.overview?.slice(0, 150),
      tmdbId: m.tmdbId,
      studio: m.studio,
      runtime: m.runtime,
      status: m.status,
    }));

    const summary = movies
      .map(
        (m) =>
          `- ${m.title} (${m.year}) [TMDB: ${m.tmdbId}]${m.studio ? ` ${m.studio}` : ''}${m.runtime ? ` ${m.runtime}min` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} result(s) for "${term}":\n${summary}`,
      data: { results: movies },
    };
  },
};
