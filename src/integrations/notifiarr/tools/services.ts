import type { ToolDefinition } from '../../_base';

interface MonitoredService {
  name: string;
  status: string;
  responseTime: string;
}

export const tool: ToolDefinition = {
  name: 'notifiarr_services',
  integration: 'notifiarr',
  description:
    'List all monitored services and their current status (up/down, response time)',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Notifications',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('notifiarr');
    ctx.log('Fetching monitored services...');

    const data = await client.get('/api/services');

    const services: MonitoredService[] = [];
    const items = Array.isArray(data) ? data : data?.services ?? [];

    for (const svc of items) {
      services.push({
        name: svc.name ?? svc.service ?? 'Unknown',
        status: svc.status ?? (svc.up ? 'up' : 'down'),
        responseTime:
          svc.responseTime != null
            ? `${svc.responseTime}ms`
            : svc.response_time != null
              ? `${svc.response_time}ms`
              : 'N/A',
      });
    }

    if (services.length === 0) {
      return {
        success: true,
        message: 'No monitored services configured in Notifiarr',
        data: { services: [] },
      };
    }

    const upCount = services.filter(
      (s) => s.status === 'up' || s.status === 'online',
    ).length;
    const summary = services
      .map((s) => `- ${s.name}: ${s.status} (${s.responseTime})`)
      .join('\n');

    return {
      success: true,
      message: `${services.length} monitored service(s), ${upCount} up:\n${summary}`,
      data: { services, total: services.length, upCount },
    };
  },
};
