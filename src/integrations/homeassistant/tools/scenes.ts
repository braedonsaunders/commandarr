import type { ToolDefinition } from '../../_base';

interface Scene {
  entity_id: string;
  name: string;
}

export const tool: ToolDefinition = {
  name: 'homeassistant_scenes',
  integration: 'homeassistant',
  description: 'List all available scenes in Home Assistant',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Scenes',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('homeassistant');
    ctx.log('Fetching Home Assistant scenes...');

    const allStates: any[] = await client.get('/api/states');

    const scenes: Scene[] = allStates
      .filter((s: any) => s.entity_id.startsWith('scene.'))
      .map((s: any) => ({
        entity_id: s.entity_id,
        name: s.attributes?.friendly_name ?? s.entity_id,
      }));

    if (scenes.length === 0) {
      return {
        success: true,
        message: 'No scenes found.',
        data: { scenes: [] },
      };
    }

    const summary = scenes
      .map((s) => `- ${s.name} (${s.entity_id})`)
      .join('\n');

    return {
      success: true,
      message: `${scenes.length} scene(s) found:\n${summary}`,
      data: { scenes },
    };
  },
};
