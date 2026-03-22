import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gluetun_restart_vpn',
  integration: 'gluetun',
  description:
    'Stop and restart the VPN connection. Useful when the connection is degraded or stuck. This will briefly interrupt all traffic routed through the VPN.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'VPN',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('gluetun');

    ctx.log('Stopping VPN connection...');
    await client.put('/v1/vpn/status', { status: 'stopped' });

    // Brief pause to allow clean shutdown
    await new Promise((resolve) => setTimeout(resolve, 2000));

    ctx.log('Starting VPN connection...');
    await client.put('/v1/vpn/status', { status: 'running' });

    // Wait a moment for reconnection
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check the new status
    let newStatus = 'unknown';
    try {
      const statusData = await client.get('/v1/vpn/status');
      newStatus = statusData?.status ?? 'unknown';
    } catch {
      // May still be reconnecting
    }

    const isConnected = newStatus === 'connected' || newStatus === 'running';

    const lines: string[] = [];
    lines.push('VPN Restart Initiated');
    lines.push('');

    if (isConnected) {
      lines.push(`Current Status: ${newStatus.toUpperCase()}`);
      lines.push('VPN connection has been re-established.');
    } else {
      lines.push(`Current Status: ${newStatus.toUpperCase()}`);
      lines.push(
        'VPN is still reconnecting. Check status again in a few seconds to confirm the connection is fully established.',
      );
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        connected: isConnected,
        status: newStatus,
      },
    };
  },
};
