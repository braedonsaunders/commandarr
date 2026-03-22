import type { ToolDefinition } from '../../_base';

interface Automation {
  entity_id: string;
  name: string;
  state: string;
  last_triggered: string;
}

export const tool: ToolDefinition = {
  name: 'homeassistant_automations',
  integration: 'homeassistant',
  description: 'List all automations in Home Assistant',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Automations',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('homeassistant');
    ctx.log('Fetching Home Assistant automations...');

    const allStates: any[] = await client.get('/api/states');

    const automations: Automation[] = allStates
      .filter((s: any) => s.entity_id.startsWith('automation.'))
      .map((s: any) => ({
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name ?? s.entity_id,
        state: s.state,
        last_triggered: s.attributes?.last_triggered
          ? new Date(s.attributes.last_triggered).toLocaleString()
          : 'never',
      }));

    if (automations.length === 0) {
      return {
        success: true,
        message: 'No automations found.',
        data: { automations: [] },
      };
    }

    const summary = automations
      .map(
        (a) => `- ${a.name} (${a.entity_id}): ${a.state}, last triggered ${a.last_triggered}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${automations.length} automation(s) found:\n${summary}`,
      data: { automations },
    };
  },
};
