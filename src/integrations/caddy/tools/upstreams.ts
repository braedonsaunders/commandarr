import type { ToolDefinition } from '../../_base';

interface UpstreamSummary {
  address: string;
  healthy: boolean;
  numRequests: number;
  fails: number;
}

export const tool: ToolDefinition = {
  name: 'caddy_upstreams',
  integration: 'caddy',
  description:
    'List reverse proxy upstream health in Caddy — addresses, healthy/unhealthy status, request counts, and failure counts',
  parameters: {
    type: 'object',
    properties: {
      unhealthyOnly: {
        type: 'boolean',
        description:
          'If true, only show unhealthy upstreams. Omit to show all.',
      },
    },
  },
  ui: {
    category: 'Reverse Proxy',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('caddy');
    ctx.log('Fetching Caddy upstream health...');

    let upstreams: any[];
    try {
      upstreams = await client.get('/reverse_proxy/upstreams');
    } catch {
      return {
        success: true,
        message:
          'No reverse proxy upstreams found (endpoint not available — this is normal if no reverse_proxy handlers are configured)',
        data: { upstreams: [] },
      };
    }

    if (!Array.isArray(upstreams) || upstreams.length === 0) {
      return {
        success: true,
        message: 'No reverse proxy upstreams found',
        data: { upstreams: [] },
      };
    }

    const items: UpstreamSummary[] = upstreams.map((u: any) => ({
      address: u.address ?? 'unknown',
      healthy: u.healthy !== false && u.num_requests !== undefined,
      numRequests: u.num_requests ?? 0,
      fails: u.fails ?? 0,
    }));

    const filtered = params.unhealthyOnly
      ? items.filter((u) => !u.healthy)
      : items;

    if (filtered.length === 0) {
      return {
        success: true,
        message: params.unhealthyOnly
          ? 'All upstreams are healthy'
          : 'No upstreams found',
        data: { upstreams: [] },
      };
    }

    const healthyCount = filtered.filter((u) => u.healthy).length;
    const unhealthyCount = filtered.filter((u) => !u.healthy).length;

    const summary = filtered
      .map(
        (u) =>
          `- ${u.healthy ? '[HEALTHY]' : '[UNHEALTHY]'} ${u.address} — ${u.numRequests} requests, ${u.fails} fails`,
      )
      .join('\n');

    return {
      success: true,
      message: `${filtered.length} upstream(s) (${healthyCount} healthy, ${unhealthyCount} unhealthy):\n${summary}`,
      data: {
        upstreams: filtered,
        total: filtered.length,
        healthyCount,
        unhealthyCount,
      },
    };
  },
};
