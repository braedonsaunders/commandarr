import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'bazarr_search_subtitles',
  integration: 'bazarr',
  description: 'Trigger a manual subtitle search for a movie or episode in Bazarr',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Type of media: "movie" or "episode"',
        enum: ['movie', 'episode'],
      },
      id: {
        type: 'number',
        description: 'The Radarr movie ID or Sonarr episode ID',
      },
      language: {
        type: 'string',
        description: 'Language code to search for (e.g. "en", "fr", "es")',
      },
    },
    required: ['type', 'id', 'language'],
  },
  ui: {
    category: 'Subtitles',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { type, id, language } = params;

    if (!type || !['movie', 'episode'].includes(type)) {
      return { success: false, message: 'Type must be "movie" or "episode"' };
    }
    if (id == null || typeof id !== 'number') {
      return { success: false, message: 'A numeric ID is required' };
    }
    if (!language || typeof language !== 'string') {
      return { success: false, message: 'A language code is required (e.g. "en")' };
    }

    const client = ctx.getClient('bazarr');
    const endpoint =
      type === 'movie'
        ? '/api/movies/subtitles'
        : '/api/episodes/subtitles';

    ctx.log(`Searching subtitles for ${type} ID ${id} in language "${language}"...`);

    const body: Record<string, any> = {
      language,
    };

    if (type === 'movie') {
      body.radarrId = id;
    } else {
      body.sonarrEpisodeId = id;
    }

    await client.post(endpoint, body);

    return {
      success: true,
      message: `Subtitle search triggered for ${type} ID ${id} in language "${language}". Bazarr will process this in the background.`,
      data: { type, id, language },
    };
  },
};
