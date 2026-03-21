import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_add',
  integration: 'radarr',
  description: 'Add a movie to Radarr by TMDB ID',
  parameters: {
    type: 'object',
    properties: {
      tmdbId: {
        type: 'number',
        description: 'TMDB ID of the movie to add',
      },
      qualityProfileId: {
        type: 'number',
        description: 'Quality profile ID (use radarr_profiles to list available profiles)',
      },
    },
    required: ['tmdbId'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { tmdbId, qualityProfileId } = params;
    if (!tmdbId || typeof tmdbId !== 'number') {
      return { success: false, message: 'TMDB ID is required' };
    }

    const client = ctx.getClient('radarr');
    ctx.log(`Adding movie with TMDB ID: ${tmdbId}`);

    // Look up the movie details from TMDB
    const lookupResults = await client.get('/api/v3/movie/lookup', {
      term: `tmdb:${tmdbId}`,
    });

    if (!Array.isArray(lookupResults) || lookupResults.length === 0) {
      return {
        success: false,
        message: `No movie found with TMDB ID ${tmdbId}`,
      };
    }

    const movieInfo = lookupResults[0];

    // Get the root folder
    const rootFolders = await client.get('/api/v3/rootfolder');
    if (!Array.isArray(rootFolders) || rootFolders.length === 0) {
      return {
        success: false,
        message: 'No root folders configured in Radarr. Add one in Settings -> Media Management.',
      };
    }
    const rootFolder = rootFolders[0];

    // Get quality profile if not specified
    let profileId = qualityProfileId;
    if (!profileId) {
      const profiles = await client.get('/api/v3/qualityprofile');
      if (!Array.isArray(profiles) || profiles.length === 0) {
        return {
          success: false,
          message: 'No quality profiles configured in Radarr.',
        };
      }
      profileId = profiles[0].id;
    }

    // Build the movie payload
    const payload = {
      title: movieInfo.title,
      tmdbId: movieInfo.tmdbId,
      year: movieInfo.year,
      qualityProfileId: profileId,
      rootFolderPath: rootFolder.path,
      monitored: true,
      addOptions: {
        monitor: 'movieOnly',
        searchForMovie: true,
      },
      images: movieInfo.images ?? [],
    };

    try {
      const added = await client.post('/api/v3/movie', payload);

      return {
        success: true,
        message: `Added "${added.title}" (${added.year}) to Radarr. Searching for downloads...`,
        data: {
          id: added.id,
          title: added.title,
          year: added.year,
          tmdbId: added.tmdbId,
          path: added.path,
          monitored: added.monitored,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Check for "already exists" error
      if (message.includes('already') || message.includes('exists')) {
        return {
          success: false,
          message: `Movie "${movieInfo.title}" (${movieInfo.year}) is already in Radarr.`,
        };
      }

      throw err;
    }
  },
};
