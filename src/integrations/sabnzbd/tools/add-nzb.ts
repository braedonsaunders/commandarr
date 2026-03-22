import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'sabnzbd_add_nzb',
  integration: 'sabnzbd',
  description: 'Add an NZB download to SABnzbd by URL',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL of the NZB file to download',
      },
      category: {
        type: 'string',
        description: 'Optional category for the download',
      },
    },
    required: ['url'],
  },
  ui: {
    category: 'Downloads',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { url, category } = params;
    if (!url || typeof url !== 'string') {
      return { success: false, message: 'NZB URL is required' };
    }

    const client = ctx.getClient('sabnzbd');
    ctx.log(`Adding NZB to SABnzbd: ${url}`);

    let path = `/api?mode=addurl&name=${encodeURIComponent(url)}`;
    if (category) {
      path += `&cat=${encodeURIComponent(category)}`;
    }

    const response = await client.get(path);

    // SABnzbd returns { status: true, nzo_ids: [...] } on success
    const success = response.status === true || response.status === 'True';
    const nzoIds = response.nzo_ids ?? [];

    if (!success) {
      return {
        success: false,
        message: `Failed to add NZB: ${response.error ?? 'Unknown error'}`,
        data: response,
      };
    }

    return {
      success: true,
      message: `NZB added to SABnzbd successfully${category ? ` in category "${category}"` : ''}`,
      data: { nzoIds },
    };
  },
};
