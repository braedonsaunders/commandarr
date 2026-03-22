import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gluetun_status',
  integration: 'gluetun',
  description:
    'Get VPN connection status, public IP address, and country. Use this to verify the VPN tunnel is active and traffic is protected.',
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
    ctx.log('Checking Gluetun VPN status...');

    const vpnStatus = await client.get('/v1/vpn/status');

    let publicIp: string | null = null;
    let country: string | null = null;
    let isp: string | null = null;

    try {
      const ipData = await client.get('/v1/publicip/ip');
      publicIp = ipData?.public_ip ?? ipData?.ip ?? (typeof ipData === 'string' ? ipData.trim() : null);
    } catch {
      // Public IP endpoint may not be available
    }

    try {
      const ipInfo = await client.get('/v1/publicip/info');
      country = ipInfo?.country ?? null;
      isp = ipInfo?.isp ?? ipInfo?.org ?? null;
    } catch {
      // IP info endpoint may not be available
    }

    const isConnected =
      vpnStatus?.status === 'connected' || vpnStatus?.status === 'running';

    const lines: string[] = [];

    if (isConnected) {
      lines.push('VPN STATUS: CONNECTED');
      lines.push('Traffic is routed through the VPN tunnel.');
    } else {
      lines.push('VPN STATUS: DISCONNECTED');
      lines.push(
        'WARNING: Traffic is NOT protected by VPN! Torrent clients may be leaking your real IP.',
      );
    }

    lines.push('');

    if (publicIp) {
      lines.push(`Public IP: ${publicIp}`);
    }
    if (country) {
      lines.push(`Country: ${country}`);
    }
    if (isp) {
      lines.push(`ISP: ${isp}`);
    }
    if (!publicIp && !country) {
      lines.push('Public IP information unavailable.');
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        connected: isConnected,
        status: vpnStatus?.status ?? 'unknown',
        publicIp,
        country,
        isp,
      },
    };
  },
};
