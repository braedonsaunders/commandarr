import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gluetun_update_servers',
  integration: 'gluetun',
  description:
    'Trigger a VPN server list update. Gluetun maintains a local copy of available VPN servers — this refreshes it from the provider.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'VPN',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('gluetun');

    // Check current updater status first
    let currentStatus = 'unknown';
    try {
      const updaterData = await client.get('/v1/updater/status');
      currentStatus = updaterData?.status ?? 'unknown';
    } catch {
      // Updater status endpoint may not be available
    }

    ctx.log('Triggering VPN server list update...');
    await client.put('/v1/updater/update');

    // Check status after trigger
    let newStatus = 'unknown';
    try {
      const updaterData = await client.get('/v1/updater/status');
      newStatus = updaterData?.status ?? 'unknown';
    } catch {
      // May still be processing
    }

    const lines = [
      'Server List Update Triggered',
      '',
      `Previous Status: ${currentStatus}`,
      `Current Status: ${newStatus}`,
      '',
      'The VPN server list is being refreshed from your provider. This may take a moment to complete.',
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        previousStatus: currentStatus,
        currentStatus: newStatus,
      },
    };
  },
};
