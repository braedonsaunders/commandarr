import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'jellyfin_restart',
  integration: 'jellyfin',
  description:
    'Restart the Jellyfin server. Always ask the user to confirm before restarting.',
  parameters: {
    type: 'object',
    properties: {
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm the restart',
      },
    },
    required: ['confirm'],
  },
  ui: {
    category: 'System',
    dangerLevel: 'high',
    testable: false,
  },
  async handler(params, ctx) {
    if (params.confirm !== true) {
      return {
        success: false,
        message: 'Restart not confirmed. Set confirm to true to restart Jellyfin.',
      };
    }

    const client = ctx.getClient('jellyfin');
    ctx.log('Attempting Jellyfin restart...');

    try {
      await client.post('/System/Restart');
      ctx.log('Restart request sent');
    } catch {
      ctx.log('Restart request sent (connection closed, expected)');
    }

    // Wait for server to come back
    ctx.log('Waiting for Jellyfin to come back online...');
    const maxWait = 120_000;
    const pollInterval = 3_000;
    const startTime = Date.now();

    // Give it a moment to actually go down
    await new Promise(r => setTimeout(r, 5000));

    while (Date.now() - startTime < maxWait) {
      try {
        await client.get('/System/Info');
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        return {
          success: true,
          message: `Jellyfin restarted successfully and is back online (took ${elapsed}s).`,
          data: { elapsedSeconds: elapsed },
        };
      } catch {
        // Still down
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }

    return {
      success: false,
      message: 'Jellyfin did not come back within 2 minutes. Manual intervention may be needed.',
    };
  },
};
