import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'homeassistant_trigger_automation',
  integration: 'homeassistant',
  description: 'Manually trigger an automation in Home Assistant',
  parameters: {
    type: 'object',
    properties: {
      entityId: {
        type: 'string',
        description: "Automation entity ID (e.g. 'automation.morning_routine')",
      },
    },
    required: ['entityId'],
  },
  ui: {
    category: 'Automations',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { entityId } = params;

    if (!entityId) {
      return { success: false, message: 'entityId is required.' };
    }

    const client = ctx.getClient('homeassistant');
    ctx.log(`Triggering automation: ${entityId}`);

    await client.post('/api/services/automation/trigger', {
      entity_id: entityId,
    });

    return {
      success: true,
      message: `Triggered automation: ${entityId}`,
      data: { entityId },
    };
  },
};
