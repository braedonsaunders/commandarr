import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'traefik_overview',
  integration: 'traefik',
  description:
    'Get Traefik overview — total routers, services, and middlewares by provider with warnings and errors count',
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
    ctx.log('Fetching Traefik overview...');

    const overview = await client.get('/api/overview');

    const sections: string[] = [];

    if (overview.http) {
      const http = overview.http;
      sections.push(
        `HTTP: ${http.routers?.total ?? 0} routers, ${http.services?.total ?? 0} services, ${http.middlewares?.total ?? 0} middlewares`,
      );
      if (http.routers?.warnings) sections.push(`  Router warnings: ${http.routers.warnings}`);
      if (http.routers?.errors) sections.push(`  Router errors: ${http.routers.errors}`);
      if (http.services?.warnings) sections.push(`  Service warnings: ${http.services.warnings}`);
      if (http.services?.errors) sections.push(`  Service errors: ${http.services.errors}`);
    }

    if (overview.tcp) {
      const tcp = overview.tcp;
      sections.push(
        `TCP: ${tcp.routers?.total ?? 0} routers, ${tcp.services?.total ?? 0} services`,
      );
    }

    if (overview.udp) {
      const udp = overview.udp;
      sections.push(
        `UDP: ${udp.routers?.total ?? 0} routers, ${udp.services?.total ?? 0} services`,
      );
    }

    if (overview.features) {
      const features = overview.features;
      const enabledFeatures = Object.entries(features)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (enabledFeatures.length > 0) {
        sections.push(`Features: ${enabledFeatures.join(', ')}`);
      }
    }

    return {
      success: true,
      message: sections.length > 0 ? sections.join('\n') : 'Traefik is running (no configuration data)',
      data: overview,
    };
  },
};
