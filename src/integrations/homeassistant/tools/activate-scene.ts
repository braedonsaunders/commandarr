import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'homeassistant_activate_scene',
  integration: 'homeassistant',
  description: 'Activate a scene in Home Assistant',
  parameters: {
    type: 'object',
    properties: {
      entityId: {
        type: 'string',
        description: "Scene entity ID (e.g. 'scene.movie_night')",
      },
    },
    required: ['entityId'],
  },
  ui: {
    category: 'Scenes',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { entityId } = params;

    if (!entityId) {
      return { success: false, message: 'entityId is required.' };
    }

    const client = ctx.getClient('homeassistant');
    ctx.log(`Activating scene: ${entityId}`);

    await client.post('/api/services/scene/turn_on', {
      entity_id: entityId,
    });

    return {
      success: true,
      message: `Activated scene: ${entityId}`,
      data: { entityId },
    };
  },
};
