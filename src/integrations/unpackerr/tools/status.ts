import type { ToolDefinition } from '../../_base';

interface StatusResponse {
  version: string;
  uptime: number;
  running: number;
  completed: number;
  failed: number;
  queued: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

export const tool: ToolDefinition = {
  name: 'unpackerr_status',
  integration: 'unpackerr',
  description: 'Get the current Unpackerr extraction status',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'System',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('unpackerr');
    ctx.log('Fetching Unpackerr status...');

    const status: StatusResponse = await client.get('/api/status');

    const lines = [
      `Version: ${status.version ?? 'unknown'}`,
      `Uptime: ${status.uptime != null ? formatUptime(status.uptime) : 'unknown'}`,
      `Running extractions: ${status.running ?? 0}`,
      `Completed: ${status.completed ?? 0}`,
      `Failed: ${status.failed ?? 0}`,
      `Queued: ${status.queued ?? 0}`,
    ];

    return {
      success: true,
      message: `Unpackerr status:\n${lines.join('\n')}`,
      data: status,
    };
  },
};
