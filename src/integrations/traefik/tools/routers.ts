import type { ToolDefinition } from '../../_base';

interface RouterSummary {
  name: string;
  rule: string;
  service: string;
  tls: boolean;
  entryPoints: string[];
  status: string;
  provider: string;
}

export const tool: ToolDefinition = {
  name: 'traefik_routers',
  integration: 'traefik',
  description:
    'List all HTTP routers in Traefik with rules, services, TLS status, entrypoints, and provider info',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description:
          'Filter by router status: "enabled", "disabled", or "warning". Omit to show all.',
        enum: ['enabled', 'disabled', 'warning'],
      },
    },
  },
  ui: {
    category: 'Reverse Proxy',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('traefik');
    ctx.log('Fetching Traefik HTTP routers...');

    const routers: any[] = await client.get('/api/http/routers');

    const statusFilter = params.status as string | undefined;
    const filtered = statusFilter
      ? routers.filter((r: any) => r.status === statusFilter)
      : routers;

    const items: RouterSummary[] = filtered.map((r: any) => ({
      name: r.name ?? 'unknown',
      rule: r.rule ?? '',
      service: r.service ?? '',
      tls: !!r.tls,
      entryPoints: r.entryPoints ?? [],
      status: r.status ?? 'unknown',
      provider: r.provider ?? 'unknown',
    }));

    if (items.length === 0) {
      return {
        success: true,
        message: statusFilter
          ? `No routers with status "${statusFilter}" found`
          : 'No HTTP routers found',
        data: { routers: [] },
      };
    }

    const tlsCount = items.filter((r) => r.tls).length;

    const summary = items
      .map(
        (r) =>
          `- [${r.status.toUpperCase()}] ${r.name} — ${r.rule} -> ${r.service}${r.tls ? ' [TLS]' : ''} (${r.entryPoints.join(', ')})`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} HTTP router(s) (${tlsCount} with TLS):\n${summary}`,
      data: { routers: items, total: items.length, tlsCount },
    };
  },
};
