import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'notifiarr_test_notification',
  integration: 'notifiarr',
  description:
    'Send a test notification to verify the Notifiarr notification pipeline is working',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('notifiarr');
    ctx.log('Sending test notification...');

    const data = await client.post('/api/notification/test');

    const success =
      data?.success === true ||
      data?.status === 'ok' ||
      data?.result === 'success';

    if (!success && data?.error) {
      return {
        success: false,
        message: `Test notification failed: ${data.error}`,
        data,
      };
    }

    return {
      success: true,
      message:
        'Test notification sent successfully. Check your configured notification channels (e.g. Discord) for the test message.',
      data,
    };
  },
};
