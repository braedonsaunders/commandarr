import type { ToolDefinition } from '../../_base';

interface Notification {
  type: string;
  service: string;
  message: string;
  timestamp: string;
  deliveryStatus: string;
}

export const tool: ToolDefinition = {
  name: 'notifiarr_recent_notifications',
  integration: 'notifiarr',
  description:
    'View recent notification events — type, service, message, timestamp, and delivery status',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of notifications to return (default: 20)',
      },
    },
  },
  ui: {
    category: 'Activity',
    dangerLevel: 'low',
    testable: true,
    testDefaults: { limit: 10 },
  },
  async handler(params, ctx) {
    const client = ctx.getClient('notifiarr');
    const limit = String(params.limit ?? 20);
    ctx.log(`Fetching last ${limit} notifications...`);

    const data = await client.get('/api/notification', { limit });

    const notifications: Notification[] = [];
    const items = Array.isArray(data)
      ? data
      : data?.notifications ?? data?.items ?? [];

    for (const n of items) {
      notifications.push({
        type: n.type ?? n.event ?? 'unknown',
        service: n.service ?? n.source ?? 'unknown',
        message: n.message ?? n.title ?? n.description ?? '',
        timestamp: n.timestamp ?? n.time ?? n.created ?? '',
        deliveryStatus: n.deliveryStatus ?? n.delivery_status ?? n.status ?? 'unknown',
      });
    }

    if (notifications.length === 0) {
      return {
        success: true,
        message: 'No recent notifications found',
        data: { notifications: [] },
      };
    }

    const summary = notifications
      .map(
        (n) =>
          `- [${n.timestamp}] ${n.type} (${n.service}): ${n.message} — ${n.deliveryStatus}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${notifications.length} recent notification(s):\n${summary}`,
      data: { notifications, total: notifications.length },
    };
  },
};
