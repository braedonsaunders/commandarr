import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gluetun_connection_check',
  integration: 'gluetun',
  description:
    'Comprehensive VPN health check: VPN status, public IP, DNS status, and port forwarding all in one. The "is everything working?" tool.',
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
    ctx.log('Running comprehensive VPN connection check...');

    const issues: string[] = [];

    // 1. VPN Status
    let vpnConnected = false;
    let vpnStatus = 'unknown';
    try {
      const vpnData = await client.get('/v1/vpn/status');
      vpnStatus = vpnData?.status ?? 'unknown';
      vpnConnected = vpnStatus === 'connected' || vpnStatus === 'running';
      if (!vpnConnected) {
        issues.push('VPN is NOT connected — traffic may be unprotected');
      }
    } catch (err: any) {
      vpnStatus = 'error';
      issues.push(`VPN status check failed: ${err.message}`);
    }

    // 2. Public IP
    let publicIp: string | null = null;
    let country: string | null = null;
    let isp: string | null = null;
    try {
      const ipData = await client.get('/v1/publicip/ip');
      publicIp =
        ipData?.public_ip ?? ipData?.ip ?? (typeof ipData === 'string' ? ipData.trim() : null);
    } catch {
      // Not critical
    }
    try {
      const ipInfo = await client.get('/v1/publicip/info');
      country = ipInfo?.country ?? null;
      isp = ipInfo?.isp ?? ipInfo?.org ?? null;
    } catch {
      // Not critical
    }

    // 3. DNS Status
    let dnsSecure = false;
    let dnsStatus = 'unknown';
    try {
      const dnsData = await client.get('/v1/dns/status');
      dnsStatus = dnsData?.status ?? 'unknown';
      dnsSecure =
        dnsStatus === 'running' || dnsStatus === 'connected' || dnsStatus === 'healthy';
      if (!dnsSecure) {
        issues.push('DNS over TLS is not active — DNS queries may be leaking');
      }
    } catch {
      dnsStatus = 'unavailable';
    }

    // 4. Port Forwarding
    let portActive = false;
    let forwardedPort = 0;
    try {
      const portData = await client.get('/v1/openvpn/portforwarded');
      forwardedPort = portData?.port ?? 0;
      portActive = forwardedPort > 0;
    } catch {
      // Port forwarding may not be supported
    }

    // Build report
    const allGood = issues.length === 0;
    const lines: string[] = [];

    if (allGood) {
      lines.push('VPN CONNECTION CHECK: ALL GOOD');
    } else {
      lines.push('VPN CONNECTION CHECK: ISSUES DETECTED');
    }
    lines.push('');

    // VPN section
    lines.push(`[VPN] ${vpnConnected ? 'CONNECTED' : 'DISCONNECTED'} (status: ${vpnStatus})`);

    // IP section
    if (publicIp) {
      lines.push(`[IP]  ${publicIp}${country ? ` (${country})` : ''}${isp ? ` — ${isp}` : ''}`);
    } else {
      lines.push('[IP]  Unable to determine public IP');
    }

    // DNS section
    lines.push(`[DNS] ${dnsSecure ? 'Secure (DoT active)' : `Not secure (status: ${dnsStatus})`}`);

    // Port forward section
    if (portActive) {
      lines.push(`[Port] Forwarded: ${forwardedPort}`);
    } else {
      lines.push('[Port] No port forwarded');
    }

    // Issues summary
    if (issues.length > 0) {
      lines.push('');
      lines.push('Issues:');
      for (const issue of issues) {
        lines.push(`  - ${issue}`);
      }
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        healthy: allGood,
        vpn: {
          connected: vpnConnected,
          status: vpnStatus,
        },
        ip: {
          address: publicIp,
          country,
          isp,
        },
        dns: {
          secure: dnsSecure,
          status: dnsStatus,
        },
        portForward: {
          active: portActive,
          port: forwardedPort,
        },
        issues,
      },
    };
  },
};
