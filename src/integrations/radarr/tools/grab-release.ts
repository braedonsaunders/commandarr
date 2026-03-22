import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'radarr_grab_release',
  integration: 'radarr',
  description:
    'Grab (download) a specific release for a movie. Use radarr_releases first to find available releases and their GUIDs.',
  parameters: {
    type: 'object',
    properties: {
      guid: {
        type: 'string',
        description: 'The GUID of the release to grab (from radarr_releases results)',
      },
      indexerId: {
        type: 'number',
        description: 'The indexer ID for the release (from radarr_releases results)',
      },
    },
    required: ['guid', 'indexerId'],
  },
  ui: {
    category: 'Movies',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    const { guid, indexerId } = params;
    const client = ctx.getClient('radarr');

    ctx.log(`Grabbing release: ${guid}`);

    try {
      await client.post('/api/v3/release', { guid, indexerId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to grab release: ${message}`,
      };
    }

    return {
      success: true,
      message: 'Release grabbed successfully. Check the download queue for progress.',
      data: { guid, indexerId },
    };
  },
};
