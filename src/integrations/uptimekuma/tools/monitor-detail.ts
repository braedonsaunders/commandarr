import type { ToolDefinition } from '../../_base';

function statusLabel(status: number | undefined): string {
  switch (status) {
    case 1:
      return 'up';
    case 0:
      return 'down';
    case 2:
      return 'pending';
    case 3:
      return 'maintenance';
    default:
      return 'unknown';
  }
}

export const tool: ToolDefinition = {
  name: 'uptimekuma_monitor_detail',
  integration: 'uptimekuma',
  description:
    'Get detailed information about a specific Uptime Kuma monitor including configuration, uptime stats, and recent heartbeats',
  parameters: {
    type: 'object',
    properties: {
      monitorId: {
        type: 'number',
        description: 'The ID of the monitor to look up',
      },
    },
    required: ['monitorId'],
  },
  ui: {
    category: 'Monitoring',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const { monitorId } = params;

    if (!monitorId) {
      return {
        success: false,
        message: 'monitorId is required',
      };
    }

    const client = ctx.getClient('uptimekuma');
    ctx.log(`Fetching monitor detail for ID ${monitorId}...`);

    let monitor: any;
    try {
      monitor = await client.get(`/api/monitors/${monitorId}`);
    } catch {
      return {
        success: false,
        message: `Monitor with ID ${monitorId} not found or not accessible`,
      };
    }

    const status = statusLabel(monitor.status);
    const uptime =
      monitor.uptime != null ? `${Number(monitor.uptime).toFixed(2)}%` : 'N/A';
    const avgResponse =
      monitor.avgResponseTime != null || monitor.latency != null
        ? `${monitor.avgResponseTime ?? monitor.latency}ms`
        : 'N/A';

    const lines = [
      `${monitor.name ?? 'Unnamed'} — ${status.toUpperCase()}`,
      `Type: ${monitor.type ?? 'unknown'}`,
      monitor.url ? `URL: ${monitor.url}` : null,
      monitor.hostname ? `Host: ${monitor.hostname}:${monitor.port ?? ''}` : null,
      `Interval: ${monitor.interval ?? 60}s`,
      `Uptime: ${uptime}`,
      `Avg Response Time: ${avgResponse}`,
      `Active: ${monitor.active !== false ? 'Yes' : 'No'}`,
      monitor.description ? `Description: ${monitor.description}` : null,
      monitor.tags?.length ? `Tags: ${monitor.tags.map((t: any) => t.name ?? t).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      success: true,
      message: lines,
      data: {
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        url: monitor.url ?? monitor.hostname,
        status,
        uptime,
        avgResponseTime: avgResponse,
        interval: monitor.interval,
        active: monitor.active !== false,
        description: monitor.description,
      },
    };
  },
};
