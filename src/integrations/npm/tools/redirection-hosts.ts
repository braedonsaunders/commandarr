import type { ToolDefinition } from '../../_base';

interface RedirectionHostSummary {
  id: number;
  domainNames: string[];
  forwardScheme: string;
  forwardDomain: string;
  preservePath: boolean;
  httpCode: number;
  enabled: boolean;
}

export const tool: ToolDefinition = {
  name: 'npm_redirection_hosts',
  integration: 'npm',
  description:
    'List all redirection hosts in Nginx Proxy Manager with source domains, forward targets, HTTP codes, and path preservation',
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
    ctx.log('Fetching NPM redirection hosts...');

    const redirections: any[] = await client.get(
      '/api/nginx/redirection-hosts',
    );

    const items: RedirectionHostSummary[] = redirections.map((r: any) => ({
      id: r.id,
      domainNames: r.domain_names ?? [],
      forwardScheme: r.forward_scheme ?? 'http',
      forwardDomain: r.forward_domain_name ?? '',
      preservePath: !!r.preserve_path,
      httpCode: r.forward_http_code ?? 301,
      enabled: r.enabled === 1,
    }));

    if (items.length === 0) {
      return {
        success: true,
        message: 'No redirection hosts found',
        data: { redirections: [] },
      };
    }

    const summary = items
      .map(
        (r) =>
          `- ${r.enabled ? '[ON]' : '[OFF]'} ${r.domainNames.join(', ')} -> ${r.forwardScheme}://${r.forwardDomain} (${r.httpCode})${r.preservePath ? ' [preserve path]' : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${items.length} redirection(s):\n${summary}`,
      data: { redirections: items, total: items.length },
    };
  },
};
