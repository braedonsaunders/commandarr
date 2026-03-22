import type { ToolDefinition } from '../../_base';

interface HealthIssue {
  type: string;
  message: string;
  wikiUrl?: string;
}

export const tool: ToolDefinition = {
  name: 'prowlarr_health',
  integration: 'prowlarr',
  description: 'Check Prowlarr system health for issues and warnings',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('prowlarr');
    ctx.log('Fetching Prowlarr health status...');

    const results = await client.get('/api/v1/health');

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No health issues reported - system is healthy',
        data: { issues: [] },
      };
    }

    const issues: HealthIssue[] = results.map((h: any) => ({
      type: h.type ?? 'unknown',
      message: h.message ?? 'No details',
      wikiUrl: h.wikiUrl,
    }));

    const summary = issues
      .map(
        (h) =>
          `- [${h.type.toUpperCase()}] ${h.message}${h.wikiUrl ? ` (${h.wikiUrl})` : ''}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${issues.length} health issue(s) found:\n${summary}`,
      data: { issues },
    };
  },
};
