import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'nzbget_add_nzb',
  integration: 'nzbget',
  description: 'Add an NZB download to NZBGet by URL',
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

    const client = ctx.getClient('nzbget');
    ctx.log(`Adding NZB to NZBGet: ${url}`);

    // Use appendurl(NzbFilename, Category, Priority, AddToTop, AddPaused, URL)
    const nzbFilename = '';
    const cat = category ?? '';
    const priority = 0;
    const addToTop = false;
    const addPaused = false;

    const response = await client.post('/jsonrpc', {
      method: 'appendurl',
      params: [nzbFilename, cat, priority, addToTop, addPaused, url],
    });

    const result = response.result ?? response;

    // appendurl returns a positive integer (NZBID) on success, 0 on failure
    if (typeof result === 'number' && result > 0) {
      return {
        success: true,
        message: `NZB added to NZBGet successfully${category ? ` in category "${category}"` : ''} (ID: ${result})`,
        data: { nzbId: result },
      };
    }

    return {
      success: false,
      message: `Failed to add NZB to NZBGet: ${JSON.stringify(response.error ?? 'Unknown error')}`,
      data: response,
    };
  },
};
