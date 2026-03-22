import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'homeassistant_call_service',
  integration: 'homeassistant',
  description: 'Call a Home Assistant service (e.g. turn on a light, lock a door)',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: "Service domain (e.g. 'light', 'switch', 'climate', 'lock', 'cover', 'fan', 'media_player')",
      },
      service: {
        type: 'string',
        description: "Service to call (e.g. 'turn_on', 'turn_off', 'toggle', 'lock', 'unlock')",
      },
      entityId: {
        type: 'string',
        description: "Target entity ID (e.g. 'light.living_room')",
      },
      data: {
        type: 'object',
        description: 'Optional extra service data (e.g. brightness, color_temp, temperature)',
      },
    },
    required: ['domain', 'service', 'entityId'],
  },
  ui: {
    category: 'Control',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { domain, service, entityId, data } = params;

    if (!domain || !service || !entityId) {
      return { success: false, message: 'domain, service, and entityId are all required.' };
    }

    const client = ctx.getClient('homeassistant');
    ctx.log(`Calling Home Assistant service: ${domain}.${service} on ${entityId}`);

    const body: Record<string, any> = {
      entity_id: entityId,
      ...data,
    };

    await client.post(`/api/services/${domain}/${service}`, body);

    return {
      success: true,
      message: `Called ${domain}.${service} on ${entityId}`,
      data: { domain, service, entityId, data },
    };
  },
};
