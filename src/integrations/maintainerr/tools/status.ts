import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'maintainerr_status',
  integration: 'maintainerr',
  description:
    'Get Maintainerr server status including version, active rules count, total managed items, and last run time',
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
    const client = ctx.getClient('maintainerr');
    ctx.log('Fetching Maintainerr status...');

    const [status, rules] = await Promise.all([
      client.get('/status'),
      client.get('/rules').catch(() => []),
    ]);

    if (!status) {
      return {
        success: false,
        message: 'Unable to retrieve status from Maintainerr',
      };
    }

    const activeRules = Array.isArray(rules)
      ? rules.filter((r: any) => r.isActive !== false).length
      : 0;
    const totalRules = Array.isArray(rules) ? rules.length : 0;
    const totalItems = Array.isArray(rules)
      ? rules.reduce((sum: number, r: any) => sum + (r.media?.length ?? r.mediaCount ?? 0), 0)
      : 0;

    const version = status.version ?? status.appVersion ?? 'Unknown';
    const lastRun = status.lastRun ?? status.lastRunAt ?? null;

    const lines = [
      `Maintainerr v${version}`,
      `Rules: ${activeRules} active / ${totalRules} total`,
      `Managed items: ${totalItems}`,
      `Last run: ${lastRun ? new Date(lastRun).toLocaleString() : 'Never'}`,
    ];

    if (status.updateAvailable) {
      lines.push(`Update available: ${status.updateVersion ?? 'Yes'}`);
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        version,
        activeRules,
        totalRules,
        totalItems,
        lastRun,
        updateAvailable: status.updateAvailable ?? false,
      },
    };
  },
};
