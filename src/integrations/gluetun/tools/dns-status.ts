import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gluetun_dns_status',
  integration: 'gluetun',
  description:
    'Get DNS over TLS status. Verify that DNS queries are encrypted and not leaking to your ISP.',
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
    ctx.log('Checking DNS over TLS status...');

    const data = await client.get('/v1/dns/status');

    const status = data?.status ?? 'unknown';
    const isSecure = status === 'running' || status === 'connected' || status === 'healthy';

    const lines: string[] = [];

    if (isSecure) {
      lines.push('DNS over TLS: ACTIVE');
      lines.push(`Status: ${status}`);
      lines.push('');
      lines.push(
        'DNS queries are encrypted. Your ISP cannot see which domains you are resolving.',
      );
    } else {
      lines.push('DNS over TLS: INACTIVE');
      lines.push(`Status: ${status}`);
      lines.push('');
      lines.push(
        'WARNING: DNS queries may not be encrypted. Your ISP could see which domains you are resolving, even with VPN active.',
      );
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        secure: isSecure,
        status,
      },
    };
  },
};
