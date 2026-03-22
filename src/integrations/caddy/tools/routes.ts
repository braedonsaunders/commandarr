import type { ToolDefinition } from '../../_base';

interface RouteSummary {
  server: string;
  listenAddresses: string[];
  matchHosts: string[];
  handlers: string[];
  terminal: boolean;
}

export const tool: ToolDefinition = {
  name: 'caddy_routes',
  integration: 'caddy',
  description:
    'List all HTTP routes in Caddy — server names, listen addresses, host matchers, and handler targets (reverse proxy destinations)',
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
    ctx.log('Fetching Caddy routes...');

    const servers = await client.get('/config/apps/http/servers/');

    if (!servers || Object.keys(servers).length === 0) {
      return {
        success: true,
        message: 'No HTTP servers configured',
        data: { routes: [] },
      };
    }

    const items: RouteSummary[] = [];

    for (const [serverName, server] of Object.entries(servers) as [string, any][]) {
      const listenAddresses: string[] = server.listen ?? [];
      const routes: any[] = server.routes ?? [];

      for (const route of routes) {
        const matchHosts: string[] = [];
        for (const matchSet of route.match ?? []) {
          if (matchSet.host) {
            matchHosts.push(...matchSet.host);
          }
        }

        const handlers: string[] = [];
        for (const handler of route.handle ?? []) {
          if (handler.handler === 'reverse_proxy') {
            const upstreams = (handler.upstreams ?? [])
              .map((u: any) => u.dial ?? u.address ?? 'unknown')
              .join(', ');
            handlers.push(`reverse_proxy -> ${upstreams}`);
          } else if (handler.handler === 'file_server') {
            handlers.push('file_server');
          } else if (handler.handler === 'static_response') {
            handlers.push(`static_response (${handler.status_code ?? 200})`);
          } else {
            handlers.push(handler.handler ?? 'unknown');
          }
        }

        items.push({
          server: serverName,
          listenAddresses,
          matchHosts,
          handlers,
          terminal: !!route.terminal,
        });
      }
    }

    if (items.length === 0) {
      return {
        success: true,
        message: 'No routes configured across any servers',
        data: { routes: [] },
      };
    }

    const summary = items
      .map((r) => {
        const hosts =
          r.matchHosts.length > 0 ? r.matchHosts.join(', ') : '*';
        const target =
          r.handlers.length > 0 ? r.handlers.join('; ') : 'no handlers';
        return `- [${r.server}] ${hosts} (${r.listenAddresses.join(', ')}) -> ${target}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${items.length} route(s):\n${summary}`,
      data: { routes: items, total: items.length },
    };
  },
};
