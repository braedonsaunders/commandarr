import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sonarr_add',
  integration: 'sonarr',
  description: 'Add a TV series to Sonarr by TVDB ID',
  parameters: {
    type: 'object',
    properties: {
      tvdbId: {
        type: 'number',
        description: 'TVDB ID of the series to add',
      },
      qualityProfileId: {
        type: 'number',
        description:
          'Quality profile ID (use sonarr_profiles to list available profiles)',
      },
      monitor: {
        type: 'string',
        description:
          'Monitor option: "all", "future", "missing", "existing", "firstSeason", "lastSeason", "none" (default: "all")',
      },
    },
    required: ['tvdbId'],
  },
  ui: {
    category: 'TV Shows',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { tvdbId, qualityProfileId, monitor } = params;
    if (!tvdbId || typeof tvdbId !== 'number') {
      return { success: false, message: 'TVDB ID is required' };
    }

    const client = ctx.getClient('sonarr');
    ctx.log(`Adding series with TVDB ID: ${tvdbId}`);

    // Look up the series details
    const lookupResults = await client.get('/api/v3/series/lookup', {
      term: `tvdb:${tvdbId}`,
    });

    if (!Array.isArray(lookupResults) || lookupResults.length === 0) {
      return {
        success: false,
        message: `No series found with TVDB ID ${tvdbId}`,
      };
    }

    const seriesInfo = lookupResults[0];

    // Get root folder
    const rootFolders = await client.get('/api/v3/rootfolder');
    if (!Array.isArray(rootFolders) || rootFolders.length === 0) {
      return {
        success: false,
        message:
          'No root folders configured in Sonarr. Add one in Settings -> Media Management.',
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
          message: 'No quality profiles configured in Sonarr.',
        };
      }
      profileId = profiles[0].id;
    }

    // Determine monitor type
    const validMonitorOptions = [
      'all',
      'future',
      'missing',
      'existing',
      'firstSeason',
      'lastSeason',
      'none',
    ];
    const monitorOption =
      typeof monitor === 'string' && validMonitorOptions.includes(monitor)
        ? monitor
        : 'all';

    // Build the series payload
    const payload = {
      title: seriesInfo.title,
      tvdbId: seriesInfo.tvdbId,
      year: seriesInfo.year,
      qualityProfileId: profileId,
      rootFolderPath: rootFolder.path,
      monitored: true,
      seasonFolder: true,
      seriesType: seriesInfo.seriesType ?? 'standard',
      addOptions: {
        monitor: monitorOption,
        searchForMissingEpisodes: true,
        searchForCutoffUnmetEpisodes: false,
      },
      seasons: seriesInfo.seasons ?? [],
      images: seriesInfo.images ?? [],
    };

    try {
      const added = await client.post('/api/v3/series', payload);

      return {
        success: true,
        message: `Added "${added.title}" (${added.year}) to Sonarr with ${added.seasonCount ?? 0} season(s). Searching for episodes...`,
        data: {
          id: added.id,
          title: added.title,
          year: added.year,
          tvdbId: added.tvdbId,
          path: added.path,
          seasonCount: added.seasonCount,
          monitored: added.monitored,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('already') || message.includes('exists')) {
        return {
          success: false,
          message: `Series "${seriesInfo.title}" (${seriesInfo.year}) is already in Sonarr.`,
        };
      }

      throw err;
    }
  },
};
