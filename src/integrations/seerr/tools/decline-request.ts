import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'seerr_decline_request',
  integration: 'seerr',
  description: 'Decline a pending media request in Seerr',
  parameters: {
    type: 'object',
    properties: {
      requestId: {
        type: 'number',
        description: 'The ID of the request to decline',
      },
    },
    required: ['requestId'],
  },
  ui: {
    category: 'Requests',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const { requestId } = params;
    if (!requestId || typeof requestId !== 'number') {
      return { success: false, message: 'requestId is required (number)' };
    }

    const client = ctx.getClient('seerr');
    ctx.log(`Declining Seerr request #${requestId}...`);

    await client.post(`/api/v1/request/${requestId}/decline`);

    return {
      success: true,
      message: `Request #${requestId} has been declined.`,
    };
  },
};
