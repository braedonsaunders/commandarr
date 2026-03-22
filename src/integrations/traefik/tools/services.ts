import type { ToolDefinition } from '../../_base';

interface ServiceSummary {
  name: string;
  type: string;
  servers: string[];
  status: string;
  provider: string;
}

export const tool: ToolDefinition = {
  name: 'traefik_services',
  integration: 'traefik',
  description:
    'List all HTTP services in Traefik with type, backend server URLs, status, and provider info',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description:
          'Filter by service status: "enabled", "disabled", or "warning". Omit to show all.',
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
    ctx.log('Fetching Traefik HTTP services...');

    const services: any[] = await client.get('/api/http/services');

    const statusFilter = params.status as string | undefined;
    const filtered = statusFilter
      ? services.filter((s: any) => s.status === statusFilter)
      : services;

    const items: ServiceSummary[] = filtered.map((s: any) => {
      let type = 'unknown';
      const servers: string[] = [];

      if (s.loadBalancer) {
        type = 'loadBalancer';
        for (const srv of s.loadBalancer.servers ?? []) {
          servers.push(srv.url ?? srv.address ?? 'unknown');
        }
      } else if (s.weighted) {
        type = 'weighted';
      } else if (s.mirroring) {
        type = 'mirroring';
      }

      return {
        name: s.name ?? 'unknown',
        type,
        servers,
        status: s.status ?? 'unknown',
        provider: s.provider ?? 'unknown',
      };
    });

    if (items.length === 0) {
      return {
        success: true,
        message: statusFilter
          ? `No services with status "${statusFilter}" found`
          : 'No HTTP services found',
        data: { services: [] },
      };
    }

    const summary = items
      .map(
        (s) =>
          `- [${s.status.toUpperCase()}] ${s.name} (${s.type})${s.servers.length > 0 ? ` -> ${s.servers.join(', ')}` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} HTTP service(s):\n${summary}`,
      data: { services: items, total: items.length },
    };
  },
};
