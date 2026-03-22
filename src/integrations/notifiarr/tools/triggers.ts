import type { ToolDefinition } from '../../_base';

interface Trigger {
  name: string;
  type: string;
  enabled: boolean;
}

export const tool: ToolDefinition = {
  name: 'notifiarr_triggers',
  integration: 'notifiarr',
  description:
    'List configured notification triggers — names, types, and enabled status',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('notifiarr');
    ctx.log('Fetching notification triggers...');

    const data = await client.get('/api/triggers');

    const triggers: Trigger[] = [];
    const items = Array.isArray(data) ? data : data?.triggers ?? [];

    for (const t of items) {
      triggers.push({
        name: t.name ?? t.trigger ?? 'Unknown',
        type: t.type ?? t.kind ?? 'unknown',
        enabled: t.enabled ?? t.active ?? false,
      });
    }

    if (triggers.length === 0) {
      return {
        success: true,
        message: 'No notification triggers configured in Notifiarr',
        data: { triggers: [] },
      };
    }

    const enabledCount = triggers.filter((t) => t.enabled).length;
    const summary = triggers
      .map(
        (t) =>
          `- ${t.name} (${t.type}): ${t.enabled ? 'enabled' : 'disabled'}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${triggers.length} trigger(s), ${enabledCount} enabled:\n${summary}`,
      data: { triggers, total: triggers.length, enabledCount },
    };
  },
};
