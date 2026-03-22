import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'npm_status',
  integration: 'npm',
  description:
    'Get Nginx Proxy Manager status overview — total proxy hosts, certificates, and upcoming certificate expirations',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Reverse Proxy',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('npm');
    ctx.log('Fetching NPM status overview...');

    const [hosts, certs] = await Promise.all([
      client.get('/api/nginx/proxy-hosts'),
      client.get('/api/nginx/certificates'),
    ]);

    const proxyHosts: any[] = Array.isArray(hosts) ? hosts : [];
    const certificates: any[] = Array.isArray(certs) ? certs : [];

    const enabledHosts = proxyHosts.filter((h: any) => h.enabled === 1).length;
    const sslHosts = proxyHosts.filter(
      (h: any) => h.certificate_id && h.certificate_id !== 0,
    ).length;

    const now = Date.now();
    const expiringCerts = certificates.filter((c: any) => {
      if (!c.expires_on) return false;
      const days = Math.floor(
        (new Date(c.expires_on).getTime() - now) / 86_400_000,
      );
      return days >= 0 && days < 30;
    });

    const expiredCerts = certificates.filter((c: any) => {
      if (!c.expires_on) return false;
      return new Date(c.expires_on).getTime() < now;
    });

    const lines: string[] = [
      `Proxy Hosts: ${proxyHosts.length} total (${enabledHosts} enabled, ${sslHosts} with SSL)`,
      `Certificates: ${certificates.length} total`,
    ];

    if (expiredCerts.length > 0) {
      lines.push(`Expired Certificates: ${expiredCerts.length}`);
    }

    if (expiringCerts.length > 0) {
      const expiringDetails = expiringCerts
        .map((c: any) => {
          const days = Math.floor(
            (new Date(c.expires_on).getTime() - now) / 86_400_000,
          );
          const domains = (c.domain_names ?? []).join(', ');
          return `  - ${domains} (${days}d remaining)`;
        })
        .join('\n');
      lines.push(`Expiring Soon (< 30 days):\n${expiringDetails}`);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        proxyHostCount: proxyHosts.length,
        enabledHostCount: enabledHosts,
        sslHostCount: sslHosts,
        certificateCount: certificates.length,
        expiringCertCount: expiringCerts.length,
        expiredCertCount: expiredCerts.length,
      },
    };
  },
};
