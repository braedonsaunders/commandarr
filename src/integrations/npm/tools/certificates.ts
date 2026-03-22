import type { ToolDefinition } from '../../_base';

interface CertificateSummary {
  id: number;
  provider: string;
  domains: string[];
  expiresOn: string | null;
  daysUntilExpiry: number | null;
  isExpiringSoon: boolean;
}

export const tool: ToolDefinition = {
  name: 'npm_certificates',
  integration: 'npm',
  description:
    'List all SSL certificates in Nginx Proxy Manager with provider, domains, expiry dates, and warnings for expiring certs',
  parameters: {
    type: 'object',
    properties: {
      expiringSoon: {
        type: 'boolean',
        description:
          'If true, only show certificates expiring within 30 days. Omit to show all.',
      },
    },
  },
  ui: {
    category: 'Reverse Proxy',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('npm');
    ctx.log('Fetching NPM certificates...');

    const certs: any[] = await client.get('/api/nginx/certificates');

    const now = Date.now();
    const items: CertificateSummary[] = certs.map((c: any) => {
      const expiresOn = c.expires_on ?? null;
      let daysUntilExpiry: number | null = null;
      if (expiresOn) {
        daysUntilExpiry = Math.floor(
          (new Date(expiresOn).getTime() - now) / 86_400_000,
        );
      }
      return {
        id: c.id,
        provider: c.provider ?? 'unknown',
        domains: c.domain_names ?? [],
        expiresOn,
        daysUntilExpiry,
        isExpiringSoon: daysUntilExpiry !== null && daysUntilExpiry < 30,
      };
    });

    const filtered = params.expiringSoon
      ? items.filter((c) => c.isExpiringSoon)
      : items;

    if (filtered.length === 0) {
      return {
        success: true,
        message: params.expiringSoon
          ? 'No certificates expiring within 30 days'
          : 'No certificates found',
        data: { certificates: [] },
      };
    }

    const expiringCount = filtered.filter((c) => c.isExpiringSoon).length;

    const summary = filtered
      .map((c) => {
        const expiry =
          c.daysUntilExpiry !== null
            ? c.daysUntilExpiry < 0
              ? `EXPIRED ${Math.abs(c.daysUntilExpiry)}d ago`
              : `${c.daysUntilExpiry}d remaining${c.isExpiringSoon ? ' ⚠' : ''}`
            : 'unknown';
        return `- [${c.provider}] ${c.domains.join(', ')} — ${expiry}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${filtered.length} certificate(s)${expiringCount > 0 ? ` (${expiringCount} expiring soon)` : ''}:\n${summary}`,
      data: { certificates: filtered, total: filtered.length, expiringCount },
    };
  },
};
