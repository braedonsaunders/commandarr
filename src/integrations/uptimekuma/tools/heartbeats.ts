import type { ToolDefinition } from '../../_base';

interface HeartbeatEntry {
  status: string;
  responseTime: number | null;
  timestamp: string;
  message: string;
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
  name: 'uptimekuma_heartbeats',
  integration: 'uptimekuma',
  description:
    'Get recent heartbeat history for a specific monitor — shows status changes, response times, and timestamps',
  parameters: {
    type: 'object',
    properties: {
      monitorId: {
        type: 'number',
        description: 'The ID of the monitor to get heartbeats for',
      },
      hours: {
        type: 'number',
        description:
          'Number of hours of history to retrieve (default: 24)',
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
    const { monitorId, hours = 24 } = params;

    if (!monitorId) {
      return {
        success: false,
        message: 'monitorId is required',
      };
    }

    const client = ctx.getClient('uptimekuma');
    ctx.log(
      `Fetching heartbeats for monitor ${monitorId} (last ${hours}h)...`,
    );

    let response: any;
    try {
      response = await client.get(`/api/monitors/${monitorId}/beats`, {
        hours: String(hours),
      });
    } catch {
      return {
        success: false,
        message: `Could not fetch heartbeats for monitor ${monitorId}`,
      };
    }

    const beats: any[] = Array.isArray(response)
      ? response
      : response?.heartbeats ?? response?.beats ?? [];

    const entries: HeartbeatEntry[] = beats.map((b: any) => ({
      status: statusLabel(b.status),
      responseTime: b.ping ?? b.responseTime ?? null,
      timestamp: b.time ?? b.timestamp ?? b.createdDate ?? '',
      message: b.msg ?? b.message ?? '',
    }));

    if (entries.length === 0) {
      return {
        success: true,
        message: `No heartbeats found for monitor ${monitorId} in the last ${hours} hour(s)`,
        data: { heartbeats: [], monitorId, hours },
      };
    }

    // Calculate stats
    const upBeats = entries.filter((e) => e.status === 'up');
    const downBeats = entries.filter((e) => e.status === 'down');
    const responseTimes = entries
      .map((e) => e.responseTime)
      .filter((r): r is number => r != null);
    const avgResponse =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          )
        : null;
    const maxResponse =
      responseTimes.length > 0 ? Math.max(...responseTimes) : null;
    const minResponse =
      responseTimes.length > 0 ? Math.min(...responseTimes) : null;

    // Show last 20 entries for readability
    const recent = entries.slice(-20);
    const beatLines = recent
      .map(
        (e) =>
          `  [${e.status.toUpperCase()}] ${e.timestamp}${e.responseTime != null ? ` — ${e.responseTime}ms` : ''}${e.message ? ` (${e.message})` : ''}`,
      )
      .join('\n');

    const statsLine = [
      `${entries.length} heartbeats in last ${hours}h`,
      `${upBeats.length} up, ${downBeats.length} down`,
      avgResponse != null ? `Avg: ${avgResponse}ms` : null,
      minResponse != null ? `Min: ${minResponse}ms` : null,
      maxResponse != null ? `Max: ${maxResponse}ms` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      success: true,
      message: `${statsLine}\n\nRecent heartbeats:\n${beatLines}`,
      data: {
        monitorId,
        hours,
        total: entries.length,
        upCount: upBeats.length,
        downCount: downBeats.length,
        avgResponseTime: avgResponse,
        minResponseTime: minResponse,
        maxResponseTime: maxResponse,
        heartbeats: entries,
      },
    };
  },
};
