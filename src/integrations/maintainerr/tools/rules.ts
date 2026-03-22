import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'maintainerr_rules',
  integration: 'maintainerr',
  description:
    'List all Maintainerr cleanup rules with their status, media type, matched item count, schedule, and description',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Rules',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('maintainerr');
    ctx.log('Fetching Maintainerr rules...');

    const rules = await client.get('/rules');

    if (!Array.isArray(rules) || rules.length === 0) {
      return {
        success: true,
        message: 'No cleanup rules configured in Maintainerr.',
        data: { rules: [] },
      };
    }

    const formatted = rules.map((rule: any) => {
      const status = rule.isActive !== false ? 'Enabled' : 'Disabled';
      const mediaType = rule.mediaType ?? rule.type ?? 'Unknown';
      const itemCount = rule.media?.length ?? rule.mediaCount ?? 0;
      const action = rule.action ?? rule.arrAction ?? 'Unknown';
      const schedule = rule.schedule ?? rule.cronSchedule ?? 'Not set';
      const name = rule.name ?? rule.description ?? `Rule #${rule.id}`;

      return [
        `[${rule.id}] ${name}`,
        `  Status: ${status} | Type: ${mediaType} | Action: ${action}`,
        `  Matched items: ${itemCount} | Schedule: ${schedule}`,
      ].join('\n');
    });

    const summary = `Found ${rules.length} rule(s):\n\n${formatted.join('\n\n')}`;

    return {
      success: true,
      message: summary,
      data: {
        rules: rules.map((r: any) => ({
          id: r.id,
          name: r.name ?? r.description ?? `Rule #${r.id}`,
          isActive: r.isActive !== false,
          mediaType: r.mediaType ?? r.type ?? 'Unknown',
          action: r.action ?? r.arrAction ?? 'Unknown',
          mediaCount: r.media?.length ?? r.mediaCount ?? 0,
          schedule: r.schedule ?? r.cronSchedule ?? null,
        })),
      },
    };
  },
};
