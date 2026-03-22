import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'autobrr_toggle_filter',
  integration: 'autobrr',
  description: 'Enable or disable an Autobrr filter by ID',
  parameters: {
    type: 'object',
    properties: {
      filterId: {
        type: 'number',
        description: 'The ID of the filter to enable or disable',
      },
      enabled: {
        type: 'boolean',
        description: 'Set to true to enable the filter, false to disable it',
      },
    },
    required: ['filterId', 'enabled'],
  },
  ui: {
    category: 'Automation',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('autobrr');
    const { filterId, enabled } = params;

    ctx.log(
      `${enabled ? 'Enabling' : 'Disabling'} Autobrr filter ${filterId}...`,
    );

    await client.put(`/api/filters/${filterId}/enabled`, { enabled });

    return {
      success: true,
      message: `Filter ${filterId} has been ${enabled ? 'enabled' : 'disabled'}`,
      data: { filterId, enabled },
    };
  },
};
