import type { ToolDefinition } from '../../_base';

interface ProviderInfo {
  name: string;
  status: string;
}

export const tool: ToolDefinition = {
  name: 'bazarr_providers',
  integration: 'bazarr',
  description: 'List configured subtitle providers in Bazarr',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Configuration',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('bazarr');
    ctx.log('Fetching subtitle providers...');

    const response = await client.get('/api/providers');

    const records = response.data ?? response ?? [];

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: true,
        message: 'No subtitle providers configured',
        data: { providers: [] },
      };
    }

    const providers: ProviderInfo[] = records.map((p: any) => ({
      name: p.name ?? 'Unknown',
      status: p.status === 'enabled' || p.enabled === true
        ? 'enabled'
        : 'disabled',
    }));

    const summary = providers
      .map((p) => `- ${p.name}: ${p.status}`)
      .join('\n');

    return {
      success: true,
      message: `${providers.length} subtitle provider(s):\n${summary}`,
      data: { providers },
    };
  },
};
