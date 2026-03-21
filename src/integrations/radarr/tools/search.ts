import type { ToolDefinition } from '../../_base';

interface MovieResult {
  title: string;
  year: number;
  overview: string;
  tmdbId: number;
  imdbId?: string;
  ratings: { value: number; type: string }[];
  studio?: string;
  runtime?: number;
  status?: string;
  images?: { coverType: string; remoteUrl: string }[];
}

export const tool: ToolDefinition = {
  name: 'radarr_search',
  integration: 'radarr',
  description: 'Search for movies to add to Radarr',
  parameters: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Search term (movie title)',
      },
    },
    required: ['term'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { term: 'inception' },
  },
  async handler(params, ctx) {
    const { term } = params;
    if (!term || typeof term !== 'string') {
      return { success: false, message: 'Search term is required' };
    }

    const client = ctx.getClient('radarr');
    ctx.log(`Searching Radarr for: ${term}`);

    const results: MovieResult[] = await client.get(
      `/api/v3/movie/lookup`,
      { term },
    );

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: `No movies found for "${term}"`,
        data: { results: [] },
      };
    }

    const movies = results.slice(0, 15).map((m) => ({
      title: m.title,
      year: m.year,
      overview: m.overview?.slice(0, 150),
      tmdbId: m.tmdbId,
      imdbId: m.imdbId,
      ratings: m.ratings,
      studio: m.studio,
      runtime: m.runtime,
      status: m.status,
    }));

    const summary = movies
      .map(
        (m) =>
          `- ${m.title} (${m.year}) [TMDB: ${m.tmdbId}]${m.runtime ? ` ${m.runtime}min` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `Found ${results.length} movie(s) for "${term}":\n${summary}`,
      data: { results: movies },
    };
  },
};
