import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'prowlarr_test_indexer',
  integration: 'prowlarr',
  description: 'Test an indexer connection in Prowlarr',
  parameters: {
    type: 'object',
    properties: {
      indexerId: {
        type: 'number',
        description: 'The ID of the indexer to test',
      },
    },
    required: ['indexerId'],
  },
  ui: {
    category: 'Indexers',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const { indexerId } = params;
    if (indexerId == null || typeof indexerId !== 'number') {
      return { success: false, message: 'indexerId is required and must be a number' };
    }

    const client = ctx.getClient('prowlarr');
    ctx.log(`Testing Prowlarr indexer ID: ${indexerId}`);

    // First fetch the indexer config to get its full body for the test endpoint
    const indexer = await client.get(`/api/v1/indexer/${indexerId}`);

    if (!indexer || !indexer.id) {
      return { success: false, message: `Indexer with ID ${indexerId} not found` };
    }

    try {
      await client.post('/api/v1/indexer/test', indexer);
      return {
        success: true,
        message: `Indexer "${indexer.name ?? indexerId}" test passed successfully`,
        data: { indexerId, name: indexer.name },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Indexer "${indexer.name ?? indexerId}" test failed: ${err.message ?? 'Unknown error'}`,
        data: { indexerId, name: indexer.name, error: err.message },
      };
    }
  },
};
