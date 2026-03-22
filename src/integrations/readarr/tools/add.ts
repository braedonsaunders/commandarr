import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'readarr_add',
  integration: 'readarr',
  description: 'Add an author to Readarr by GoodReads ID',
  parameters: {
    type: 'object',
    properties: {
      foreignAuthorId: {
        type: 'string',
        description: 'GoodReads ID of the author to add',
      },
      qualityProfileId: {
        type: 'number',
        description: 'Quality profile ID (use readarr_profiles to list available profiles)',
      },
      metadataProfileId: {
        type: 'number',
        description: 'Metadata profile ID',
      },
    },
    required: ['foreignAuthorId'],
  },
  ui: {
    category: 'Books',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { foreignAuthorId, qualityProfileId, metadataProfileId } = params;
    if (!foreignAuthorId || typeof foreignAuthorId !== 'string') {
      return { success: false, message: 'GoodReads author ID is required' };
    }

    const client = ctx.getClient('readarr');
    ctx.log(`Adding author with GoodReads ID: ${foreignAuthorId}`);

    // Look up the author details
    const lookupResults = await client.get('/api/v1/author/lookup', {
      term: `readarr:${foreignAuthorId}`,
    });

    if (!Array.isArray(lookupResults) || lookupResults.length === 0) {
      return {
        success: false,
        message: `No author found with GoodReads ID ${foreignAuthorId}`,
      };
    }

    const authorInfo = lookupResults[0];

    // Get the root folder
    const rootFolders = await client.get('/api/v1/rootfolder');
    if (!Array.isArray(rootFolders) || rootFolders.length === 0) {
      return {
        success: false,
        message: 'No root folders configured in Readarr. Add one in Settings -> Media Management.',
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
          message: 'No quality profiles configured in Readarr.',
        };
      }
      profileId = profiles[0].id;
    }

    // Get metadata profile if not specified
    let metaProfileId = metadataProfileId;
    if (!metaProfileId) {
      const metadataProfiles = await client.get('/api/v1/metadataprofile');
      if (Array.isArray(metadataProfiles) && metadataProfiles.length > 0) {
        metaProfileId = metadataProfiles[0].id;
      } else {
        metaProfileId = 1;
      }
    }

    // Build the author payload
    const payload = {
      authorName: authorInfo.authorName,
      foreignAuthorId: authorInfo.foreignAuthorId,
      qualityProfileId: profileId,
      metadataProfileId: metaProfileId,
      rootFolderPath: rootFolder.path,
      monitored: true,
      addOptions: {
        monitor: 'all',
        searchForMissingBooks: true,
      },
      images: authorInfo.images ?? [],
    };

    try {
      const added = await client.post('/api/v1/author', payload);

      return {
        success: true,
        message: `Added "${added.authorName}" to Readarr. Searching for missing books...`,
        data: {
          id: added.id,
          authorName: added.authorName,
          foreignAuthorId: added.foreignAuthorId,
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
          message: `Author "${authorInfo.authorName}" is already in Readarr.`,
        };
      }

      throw err;
    }
  },
};
