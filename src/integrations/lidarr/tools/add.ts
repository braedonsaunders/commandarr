import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'lidarr_add',
  integration: 'lidarr',
  description: 'Add an artist to Lidarr by MusicBrainz ID',
  parameters: {
    type: 'object',
    properties: {
      foreignArtistId: {
        type: 'string',
        description: 'MusicBrainz ID of the artist to add',
      },
      qualityProfileId: {
        type: 'number',
        description: 'Quality profile ID (use lidarr_profiles to list available profiles)',
      },
    },
    required: ['foreignArtistId'],
  },
  ui: {
    category: 'Music',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { foreignArtistId, qualityProfileId } = params;
    if (!foreignArtistId || typeof foreignArtistId !== 'string') {
      return { success: false, message: 'MusicBrainz artist ID is required' };
    }

    const client = ctx.getClient('lidarr');
    ctx.log(`Adding artist with MusicBrainz ID: ${foreignArtistId}`);

    // Look up the artist details
    const lookupResults = await client.get('/api/v1/artist/lookup', {
      term: `lidarr:${foreignArtistId}`,
    });

    if (!Array.isArray(lookupResults) || lookupResults.length === 0) {
      return {
        success: false,
        message: `No artist found with MusicBrainz ID ${foreignArtistId}`,
      };
    }

    const artistInfo = lookupResults[0];

    // Get the root folder
    const rootFolders = await client.get('/api/v1/rootfolder');
    if (!Array.isArray(rootFolders) || rootFolders.length === 0) {
      return {
        success: false,
        message: 'No root folders configured in Lidarr. Add one in Settings -> Media Management.',
      };
    }
    const rootFolder = rootFolders[0];

    // Get quality profile if not specified
    let profileId = qualityProfileId;
    if (!profileId) {
      const profiles = await client.get('/api/v1/qualityprofile');
      if (!Array.isArray(profiles) || profiles.length === 0) {
        return {
          success: false,
          message: 'No quality profiles configured in Lidarr.',
        };
      }
      profileId = profiles[0].id;
    }

    // Get metadata profile (required by Lidarr)
    const metadataProfiles = await client.get('/api/v1/metadataprofile');
    let metadataProfileId = 1;
    if (Array.isArray(metadataProfiles) && metadataProfiles.length > 0) {
      metadataProfileId = metadataProfiles[0].id;
    }

    // Build the artist payload
    const payload = {
      artistName: artistInfo.artistName,
      foreignArtistId: artistInfo.foreignArtistId,
      qualityProfileId: profileId,
      metadataProfileId,
      rootFolderPath: rootFolder.path,
      monitored: true,
      addOptions: {
        monitor: 'allAlbums',
        searchForMissingAlbums: true,
      },
      images: artistInfo.images ?? [],
    };

    try {
      const added = await client.post('/api/v1/artist', payload);

      return {
        success: true,
        message: `Added "${added.artistName}" to Lidarr. Searching for missing albums...`,
        data: {
          id: added.id,
          artistName: added.artistName,
          foreignArtistId: added.foreignArtistId,
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
          message: `Artist "${artistInfo.artistName}" is already in Lidarr.`,
        };
      }

      throw err;
    }
  },
};
