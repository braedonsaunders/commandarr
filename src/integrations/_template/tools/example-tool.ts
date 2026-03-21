import type { ToolDefinition } from '../../_base';

/**
 * Example tool template.
 * Each tool file must export a `tool` constant of type ToolDefinition.
 *
 * Naming convention: {integration}_{action}
 * Example: plex_search, radarr_add, sonarr_queue
 */
export const tool: ToolDefinition = {
  name: 'template_example',
  integration: 'template',
  description: 'An example tool that demonstrates the tool structure',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'A test message to echo back',
      },
    },
    required: ['message'],
  },
  ui: {
    category: 'General',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { message: 'Hello from template!' },
  },
  async handler(params, ctx) {
    const { message } = params;

    if (!message || typeof message !== 'string') {
      return { success: false, message: 'Message parameter is required' };
    }

    // Get the client for this integration
    const client = ctx.getClient('template');
    ctx.log(`Example tool called with message: ${message}`);

    // Example API call (replace with your actual endpoint)
    // const data = await client.get('/api/some-endpoint');

    return {
      success: true,
      message: `Echo: ${message}`,
      data: { echo: message, timestamp: new Date().toISOString() },
    };
  },
};
