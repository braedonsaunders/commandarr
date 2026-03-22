import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'seerr_approve_request',
  integration: 'seerr',
  description: 'Approve a pending media request in Seerr',
  parameters: {
    type: 'object',
    properties: {
      requestId: {
        type: 'number',
        description: 'The ID of the request to approve',
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
    ctx.log(`Approving Seerr request #${requestId}...`);

    await client.post(`/api/v1/request/${requestId}/approve`);

    return {
      success: true,
      message: `Request #${requestId} has been approved.`,
    };
  },
};
