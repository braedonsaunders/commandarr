import type { ToolDefinition } from '../../_base';

interface ProxyHostSummary {
  id: number;
  domainNames: string[];
  forwardHost: string;
  forwardPort: number;
  sslEnabled: boolean;
  sslExpiry: string | null;
  enabled: boolean;
  accessListId: number;
}

export const tool: ToolDefinition = {
  name: 'npm_proxy_hosts',
  integration: 'npm',
  description:
    'List all proxy hosts in Nginx Proxy Manager with domain names, forward targets, SSL status, and access control',
  parameters: {
    type: 'object',
    properties: {
      enabled: {
        type: 'boolean',
        description: 'Filter by enabled/disabled status. Omit to show all.',
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
    ctx.log('Fetching NPM proxy hosts...');

    const hosts: any[] = await client.get('/api/nginx/proxy-hosts');

    const enabledFilter = params.enabled as boolean | undefined;
    const filtered =
      enabledFilter !== undefined
        ? hosts.filter((h: any) => (h.enabled === 1) === enabledFilter)
        : hosts;

    const items: ProxyHostSummary[] = filtered.map((h: any) => ({
      id: h.id,
      domainNames: h.domain_names ?? [],
      forwardHost: h.forward_host ?? '',
      forwardPort: h.forward_port ?? 0,
      sslEnabled: !!(h.certificate_id && h.certificate_id !== 0),
      sslExpiry: h.certificate?.expires_on ?? null,
      enabled: h.enabled === 1,
      accessListId: h.access_list_id ?? 0,
    }));

    if (items.length === 0) {
      return {
        success: true,
        message: 'No proxy hosts found',
        data: { proxyHosts: [] },
      };
    }

    const sslCount = items.filter((h) => h.sslEnabled).length;
    const enabledCount = items.filter((h) => h.enabled).length;

    const summary = items
      .map(
        (h) =>
          `- ${h.enabled ? '[ON]' : '[OFF]'} ${h.domainNames.join(', ')} -> ${h.forwardHost}:${h.forwardPort}${h.sslEnabled ? ' [SSL]' : ''}${h.accessListId ? ` [ACL:${h.accessListId}]` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} proxy host(s) (${enabledCount} enabled, ${sslCount} with SSL):\n${summary}`,
      data: { proxyHosts: items, total: items.length, sslCount, enabledCount },
    };
  },
};
