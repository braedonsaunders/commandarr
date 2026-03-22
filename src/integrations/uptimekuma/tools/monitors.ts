import type { ToolDefinition } from '../../_base';

interface MonitorSummary {
  id: number;
  name: string;
  type: string;
  url: string;
  status: string;
  uptime: string;
  responseTime: string;
  interval: number;
}

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
  name: 'uptimekuma_monitors',
  integration: 'uptimekuma',
  description:
    'List all monitors in Uptime Kuma with their current status, uptime percentage, and response times',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description:
          'Filter monitors by status: "up", "down", or "pending". Omit to show all.',
        enum: ['up', 'down', 'pending'],
      },
    },
  },
  ui: {
    category: 'Monitoring',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(params, ctx) {
    const client = ctx.getClient('uptimekuma');
    ctx.log('Fetching Uptime Kuma monitors...');

    const response = await client.get('/api/monitors');
    const monitors: any[] = Array.isArray(response)
      ? response
      : response?.monitors ?? [];

    const statusFilter = params.status as string | undefined;
    const statusCodeMap: Record<string, number> = {
      up: 1,
      down: 0,
      pending: 2,
    };

    const filtered = statusFilter
      ? monitors.filter(
          (m: any) => m.active !== false && m.status === statusCodeMap[statusFilter],
        )
      : monitors;

    const items: MonitorSummary[] = filtered.map((m: any) => ({
      id: m.id,
      name: m.name ?? 'Unnamed',
      type: m.type ?? 'unknown',
      url: m.url ?? m.hostname ?? '',
      status: statusLabel(m.status),
      uptime: m.uptime != null ? `${Number(m.uptime).toFixed(2)}%` : 'N/A',
      responseTime:
        m.avgResponseTime != null || m.latency != null
          ? `${m.avgResponseTime ?? m.latency}ms`
          : 'N/A',
      interval: m.interval ?? 60,
    }));

    if (items.length === 0) {
      return {
        success: true,
        message: statusFilter
          ? `No monitors with status "${statusFilter}" found`
          : 'No monitors found',
        data: { monitors: [] },
      };
    }

    const upCount = items.filter((m) => m.status === 'up').length;
    const downCount = items.filter((m) => m.status === 'down').length;
    const pendingCount = items.filter((m) => m.status === 'pending').length;

    const summary = items
      .map(
        (m) =>
          `- [${m.status.toUpperCase()}] ${m.name} (${m.type}) — ${m.url || 'no URL'} | Uptime: ${m.uptime} | Response: ${m.responseTime}`,
      )
      .join('\n');

    const headerParts = [`${items.length} monitor(s)`];
    if (upCount > 0) headerParts.push(`${upCount} up`);
    if (downCount > 0) headerParts.push(`${downCount} down`);
    if (pendingCount > 0) headerParts.push(`${pendingCount} pending`);

    return {
      success: true,
      message: `${headerParts.join(', ')}:\n${summary}`,
      data: { monitors: items, upCount, downCount, pendingCount },
    };
  },
};
