import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'gotify_send_message',
  integration: 'gotify',
  description:
    'Send a push notification via Gotify — create a message with title, content, and priority',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The notification message body',
      },
      title: {
        type: 'string',
        description: 'Optional notification title',
      },
      priority: {
        type: 'number',
        description:
          'Message priority (default: 5). Higher values = more important. Gotify uses 0-10 scale.',
      },
    },
    required: ['message'],
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'medium',
    testable: false,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('gotify');
    ctx.log('Sending message via Gotify...');

    const body: Record<string, unknown> = {
      message: params.message,
      priority: params.priority ?? 5,
    };

    if (params.title) {
      body.title = params.title;
    }

    const result = await client.post('/message', body);

    const priorityLabel = params.priority != null ? ` (priority: ${params.priority})` : '';

    return {
      success: true,
      message: `Message sent via Gotify${priorityLabel}: ${params.title ? params.title + ' — ' : ''}${params.message}`,
      data: result,
    };
  },
};
