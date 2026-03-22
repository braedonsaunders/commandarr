import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_toggle_monitoring',
  integration: 'radarr',
  description:
    'Toggle monitoring for a movie in Radarr. When monitoring is enabled, Radarr will automatically search for and download the movie.',
  parameters: {
    type: 'object',
    properties: {
      movieId: {
        type: 'number',
        description: 'Radarr movie ID',
      },
      monitored: {
        type: 'boolean',
        description: 'Whether to enable (true) or disable (false) monitoring',
      },
    },
    required: ['movieId', 'monitored'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { movieId, monitored } = params;
    const client = ctx.getClient('radarr');

    ctx.log(`Fetching movie ID ${movieId}...`);
    let movie: any;
    try {
      movie = await client.get(`/api/v3/movie/${movieId}`);
    } catch {
      return { success: false, message: `No movie found with ID ${movieId}` };
    }

    const title = movie.title ?? 'Unknown';
    ctx.log(`Setting "${title}" monitored = ${monitored}`);
    movie.monitored = monitored;

    await client.put(`/api/v3/movie/${movieId}`, movie);

    return {
      success: true,
      message: `Monitoring ${monitored ? 'enabled' : 'disabled'} for "${title}" (${movie.year}).`,
      data: { movieId, title, year: movie.year, monitored },
    };
  },
};
