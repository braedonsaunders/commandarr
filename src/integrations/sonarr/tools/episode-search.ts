import type { ToolDefinition } from '../../_base';

interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
}

export const tool: ToolDefinition = {
  name: 'sonarr_episode_search',
  integration: 'sonarr',
  description:
    'Trigger a search for episodes of a series in Sonarr. Can search the whole series or a specific season.',
  parameters: {
    type: 'object',
    properties: {
      seriesId: {
        type: 'number',
        description: 'Sonarr series ID to search episodes for',
      },
      seasonNumber: {
        type: 'number',
        description:
          'Optional season number. If provided, only episodes from this season will be searched.',
      },
    },
    required: ['seriesId'],
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { seriesId, seasonNumber } = params;
    if (!seriesId || typeof seriesId !== 'number') {
      return { success: false, message: 'Series ID is required' };
    }

    const client = ctx.getClient('sonarr');

    if (seasonNumber !== undefined && seasonNumber !== null) {
      ctx.log(
        `Searching for episodes in season ${seasonNumber} of series ${seriesId}...`,
      );

      // Fetch all episodes for the series and filter to the requested season
      const episodes: Episode[] = await client.get('/api/v3/episode', {
        seriesId: String(seriesId),
      });

      if (!Array.isArray(episodes) || episodes.length === 0) {
        return {
          success: false,
          message: `No episodes found for series ${seriesId}`,
        };
      }

      const seasonEpisodes = episodes.filter(
        (ep: Episode) => ep.seasonNumber === seasonNumber,
      );

      if (seasonEpisodes.length === 0) {
        return {
          success: false,
          message: `No episodes found for season ${seasonNumber} of series ${seriesId}`,
        };
      }

      const episodeIds = seasonEpisodes.map((ep: Episode) => ep.id);

      await client.post('/api/v3/command', {
        name: 'EpisodeSearch',
        episodeIds,
      });

      return {
        success: true,
        message: `Triggered search for ${episodeIds.length} episode(s) in season ${seasonNumber}`,
        data: {
          seriesId,
          seasonNumber,
          episodeCount: episodeIds.length,
          episodeIds,
        },
      };
    }

    // No season specified — search the whole series
    ctx.log(`Searching for all episodes of series ${seriesId}...`);

    await client.post('/api/v3/command', {
      name: 'SeriesSearch',
      seriesId,
    });

    return {
      success: true,
      message: `Triggered full series search for series ${seriesId}`,
      data: { seriesId },
    };
  },
};
