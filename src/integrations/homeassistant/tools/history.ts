import type { ToolDefinition } from '../../_base';

interface StateChange {
  state: string;
  last_changed: string;
}

export const tool: ToolDefinition = {
  name: 'homeassistant_history',
  integration: 'homeassistant',
  description: 'Get state change history for a specific entity',
  parameters: {
    type: 'object',
    properties: {
      entityId: {
        type: 'string',
        description: "Entity ID to get history for (e.g. 'sensor.temperature')",
      },
      hours: {
        type: 'number',
        description: 'Number of hours of history to retrieve (default: 24)',
      },
    },
    required: ['entityId'],
  },
  ui: {
    category: 'Analytics',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const { entityId } = params;
    const hours = params.hours ?? 24;

    if (!entityId) {
      return { success: false, message: 'entityId is required.' };
    }

    const client = ctx.getClient('homeassistant');
    ctx.log(`Fetching ${hours}h history for ${entityId}...`);

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const response = await client.get(
      `/api/history/period/${since}`,
      {
        filter_entity_id: entityId,
        minimal_response: 'true',
      },
    );

    // Response is an array of arrays; first element contains the entity's history
    const entityHistory = Array.isArray(response) && response.length > 0
      ? response[0]
      : [];

    if (!Array.isArray(entityHistory) || entityHistory.length === 0) {
      return {
        success: true,
        message: `No history found for ${entityId} in the last ${hours} hour(s).`,
        data: { entityId, hours, changes: [] },
      };
    }

    const changes: StateChange[] = entityHistory.map((entry: any) => ({
      state: entry.state ?? 'unknown',
      last_changed: entry.last_changed
        ? new Date(entry.last_changed).toLocaleString()
        : 'unknown',
    }));

    const summary = changes
      .map((c) => `- ${c.state} at ${c.last_changed}`)
      .join('\n');

    return {
      success: true,
      message: `${changes.length} state change(s) for ${entityId} in the last ${hours}h:\n${summary}`,
      data: { entityId, hours, changes },
    };
  },
};
