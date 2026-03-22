import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'caddy_status',
  integration: 'caddy',
  description:
    'Get Caddy status overview — server count, total routes, and TLS configuration summary',
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
    const client = ctx.getClient('caddy');
    ctx.log('Fetching Caddy config overview...');

    const config = await client.get('/config/');

    const lines: string[] = [];
    let serverCount = 0;
    let routeCount = 0;
    let hasTls = false;

    if (config?.apps?.http?.servers) {
      const servers = config.apps.http.servers;
      serverCount = Object.keys(servers).length;

      for (const [name, server] of Object.entries(servers) as [string, any][]) {
        const routes = server.routes ?? [];
        routeCount += routes.length;
        lines.push(
          `Server "${name}": listening on ${(server.listen ?? []).join(', ')} — ${routes.length} route(s)`,
        );
      }
    }

    if (config?.apps?.tls) {
      hasTls = true;
      const tls = config.apps.tls;
      const automationPolicies = tls.automation?.policies ?? [];
      const managedDomains = automationPolicies.flatMap(
        (p: any) => p.subjects ?? [],
      );
      if (managedDomains.length > 0) {
        lines.push(`TLS: ${managedDomains.length} managed domain(s)`);
      } else {
        lines.push('TLS: configured (automatic HTTPS)');
      }
    }

    if (lines.length === 0) {
      lines.push('Caddy is running with no HTTP servers configured');
    }

    return {
      success: true,
      message: `${serverCount} server(s), ${routeCount} route(s)${hasTls ? ', TLS active' : ''}:\n${lines.join('\n')}`,
      data: {
        serverCount,
        routeCount,
        hasTls,
        config,
      },
    };
  },
};
