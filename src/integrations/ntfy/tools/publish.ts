import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'ntfy_publish',
  integration: 'ntfy',
  description:
    'Publish a push notification to an ntfy topic — supports title, priority, and emoji tags',
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
      topic: {
        type: 'string',
        description:
          'Topic to publish to. Defaults to the configured default topic if not specified.',
      },
      priority: {
        type: 'number',
        description:
          'Notification priority from 1 (min) to 5 (max). 1=min, 2=low, 3=default, 4=high, 5=urgent',
        minimum: 1,
        maximum: 5,
      },
      tags: {
        type: 'string',
        description:
          'Comma-separated emoji tags for the notification (e.g. "warning,skull" or "tada,partying_face")',
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
    const client = ctx.getClient('ntfy');
    const topic = params.topic || '{defaultTopic}';
    ctx.log(`Publishing notification to topic: ${topic}`);

    const body: Record<string, unknown> = {
      message: params.message,
    };

    if (params.title) body.title = params.title;
    if (params.priority) body.priority = params.priority;
    if (params.tags) body.tags = params.tags.split(',').map((t: string) => t.trim());

    // ntfy expects POST to /{topic} with JSON body containing "topic" field,
    // or we can POST to / with "topic" in the JSON body
    body.topic = topic;

    const result = await client.post('/', body);

    const priorityLabels: Record<number, string> = {
      1: 'min',
      2: 'low',
      3: 'default',
      4: 'high',
      5: 'urgent',
    };
    const prioLabel = params.priority
      ? ` (priority: ${priorityLabels[params.priority] ?? params.priority})`
      : '';

    return {
      success: true,
      message: `Notification published to topic "${topic}"${prioLabel}: ${params.message}`,
      data: result,
    };
  },
};
