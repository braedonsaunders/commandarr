import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gluetun_port_forward',
  integration: 'gluetun',
  description:
    'Get the current port-forwarded port. Critical for torrent client configuration — if the forwarded port changes, the torrent client needs to be updated to match.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'VPN',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('gluetun');
    ctx.log('Checking port-forwarded port...');

    const data = await client.get('/v1/openvpn/portforwarded');

    const port = data?.port ?? 0;
    const isActive = port > 0;

    const lines: string[] = [];

    if (isActive) {
      lines.push(`Port Forwarding: ACTIVE`);
      lines.push(`Forwarded Port: ${port}`);
      lines.push('');
      lines.push(
        'Ensure your torrent client is configured to use this port for incoming connections.',
      );
    } else {
      lines.push('Port Forwarding: INACTIVE');
      lines.push('');
      lines.push(
        'No port is currently forwarded. This may mean your VPN provider does not support port forwarding, or it has not been configured.',
      );
      lines.push(
        'Without port forwarding, torrent downloads may be slower due to limited connectivity.',
      );
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        active: isActive,
        port,
      },
    };
  },
};
