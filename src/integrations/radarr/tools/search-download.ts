import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_search_download',
  integration: 'radarr',
  description:
    'Trigger a search for a movie in Radarr to find and download it from indexers. The movie must already be added to Radarr.',
  parameters: {
    type: 'object',
    properties: {
      movieId: {
        type: 'number',
        description: 'Radarr movie ID to search for',
      },
    },
    required: ['movieId'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { movieId } = params;
    const client = ctx.getClient('radarr');

    ctx.log(`Fetching movie info for ID ${movieId}...`);

    let movie: any;
    try {
      movie = await client.get(`/api/v3/movie/${movieId}`);
    } catch {
      return {
        success: false,
        message: `No movie found with ID ${movieId}`,
      };
    }

    const title = movie.title ?? 'Unknown';
    const year = movie.year ?? '';

    ctx.log(`Triggering search for: ${title} (${year})`);

    await client.post('/api/v3/command', {
      name: 'MoviesSearch',
      movieIds: [movieId],
    });

    return {
      success: true,
      message: `Search triggered for ${title} (${year}). Radarr will now search your indexers for available releases.`,
      data: {
        movieId,
        title,
        year,
      },
    };
  },
};
