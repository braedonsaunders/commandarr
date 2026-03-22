import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'maintainerr_rule_details',
  integration: 'maintainerr',
  description:
    'Get detailed information about a specific Maintainerr rule including conditions, matched items, action type, and history',
  parameters: {
    type: 'object',
    properties: {
      ruleId: {
        type: 'number',
        description: 'The ID of the rule to get details for',
      },
    },
    required: ['ruleId'],
  },
  ui: {
    category: 'Rules',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('maintainerr');
    const { ruleId } = params;
    ctx.log(`Fetching details for rule #${ruleId}...`);

    const rule = await client.get(`/rules/${ruleId}`);

    if (!rule) {
      return {
        success: false,
        message: `Rule #${ruleId} not found`,
      };
    }

    const name = rule.name ?? rule.description ?? `Rule #${rule.id}`;
    const status = rule.isActive !== false ? 'Enabled' : 'Disabled';
    const mediaType = rule.mediaType ?? rule.type ?? 'Unknown';
    const action = rule.action ?? rule.arrAction ?? 'Unknown';
    const schedule = rule.schedule ?? rule.cronSchedule ?? 'Not set';

    const lines = [
      `Rule #${rule.id}: ${name}`,
      `Status: ${status}`,
      `Media type: ${mediaType}`,
      `Action: ${action}`,
      `Schedule: ${schedule}`,
    ];

    if (rule.description && rule.description !== name) {
      lines.push(`Description: ${rule.description}`);
    }

    // Format conditions
    const conditions = rule.rules ?? rule.conditions ?? [];
    if (Array.isArray(conditions) && conditions.length > 0) {
      lines.push('', 'Conditions:');
      conditions.forEach((cond: any, i: number) => {
        const operator = cond.operator ?? cond.comparison ?? '=';
        const field = cond.firstVal ?? cond.field ?? 'Unknown field';
        const value = cond.lastVal ?? cond.value ?? '';
        lines.push(`  ${i + 1}. ${field} ${operator} ${value}`);
      });
    }

    // Format matched items
    const media = rule.media ?? [];
    if (Array.isArray(media) && media.length > 0) {
      lines.push('', `Matched items (${media.length}):`);
      const displayItems = media.slice(0, 20);
      displayItems.forEach((item: any) => {
        const title = item.title ?? item.name ?? 'Unknown';
        const addedDate = item.addDate ?? item.createdAt ?? null;
        const dateStr = addedDate
          ? ` (added ${new Date(addedDate).toLocaleDateString()})`
          : '';
        lines.push(`  - ${title}${dateStr}`);
      });
      if (media.length > 20) {
        lines.push(`  ... and ${media.length - 20} more`);
      }
    } else {
      lines.push('', 'No items currently matched by this rule.');
    }

    // Format history
    const history = rule.history ?? rule.actionHistory ?? [];
    if (Array.isArray(history) && history.length > 0) {
      lines.push('', 'Recent action history:');
      const recentHistory = history.slice(0, 10);
      recentHistory.forEach((entry: any) => {
        const date = entry.date ?? entry.createdAt ?? 'Unknown date';
        const dateStr = date !== 'Unknown date' ? new Date(date).toLocaleDateString() : date;
        const itemTitle = entry.title ?? entry.mediaTitle ?? 'Unknown item';
        const actionTaken = entry.action ?? entry.type ?? 'processed';
        lines.push(`  - ${dateStr}: ${itemTitle} - ${actionTaken}`);
      });
    }

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        id: rule.id,
        name,
        isActive: rule.isActive !== false,
        mediaType,
        action,
        schedule,
        conditionCount: conditions.length,
        matchedItemCount: media.length,
        historyCount: history.length,
      },
    };
  },
};
