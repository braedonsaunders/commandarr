import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'maintainerr_run_rule',
  integration: 'maintainerr',
  description:
    'Trigger a specific Maintainerr cleanup rule to run immediately. Use with caution as this can trigger deletions or library modifications.',
  parameters: {
    type: 'object',
    properties: {
      ruleId: {
        type: 'number',
        description: 'The ID of the rule to trigger',
      },
    },
    required: ['ruleId'],
  },
  ui: {
    category: 'Rules',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('maintainerr');
    const { ruleId } = params;
    ctx.log(`Triggering rule #${ruleId}...`);

    // First fetch the rule to confirm it exists and show what we're running
    const rule = await client.get(`/rules/${ruleId}`).catch(() => null);

    if (!rule) {
      return {
        success: false,
        message: `Rule #${ruleId} not found. Use maintainerr_rules to list available rules.`,
      };
    }

    const ruleName = rule.name ?? rule.description ?? `Rule #${ruleId}`;
    const action = rule.action ?? rule.arrAction ?? 'Unknown';
    const matchedCount = rule.media?.length ?? rule.mediaCount ?? 0;

    // Trigger the rule
    const result = await client.post(`/rules/${ruleId}/run`);

    const lines = [
      `Rule "${ruleName}" triggered successfully.`,
      `Action type: ${action}`,
      `Items currently matched: ${matchedCount}`,
    ];

    if (result?.message) {
      lines.push(`Server response: ${result.message}`);
    }

    lines.push(
      '',
      'The rule is now running in the background. Use maintainerr_logs to monitor progress.',
    );

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        ruleId,
        ruleName,
        action,
        matchedCount,
        triggered: true,
      },
    };
  },
};
