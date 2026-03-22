import type { ToolDefinition } from '../../_base';

interface EntrypointSummary {
  name: string;
  address: string;
  protocol: string;
}

export const tool: ToolDefinition = {
  name: 'traefik_entrypoints',
  integration: 'traefik',
  description:
    'List all entrypoints in Traefik — configured listening addresses, ports, and protocols',
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
    const client = ctx.getClient('traefik');
    ctx.log('Fetching Traefik entrypoints...');

    const entrypoints: any[] = await client.get('/api/entrypoints');

    const items: EntrypointSummary[] = entrypoints.map((ep: any) => ({
      name: ep.name ?? 'unknown',
      address: ep.address ?? '',
      protocol: ep.protocol ?? (ep.address?.includes('/udp') ? 'UDP' : 'TCP'),
    }));

    if (items.length === 0) {
      return {
        success: true,
        message: 'No entrypoints found',
        data: { entrypoints: [] },
      };
    }

    const summary = items
      .map((ep) => `- ${ep.name} — ${ep.address} (${ep.protocol})`)
      .join('\n');

    return {
      success: true,
      message: `${items.length} entrypoint(s):\n${summary}`,
      data: { entrypoints: items, total: items.length },
    };
  },
};
