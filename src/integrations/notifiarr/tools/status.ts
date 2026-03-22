import type { ToolDefinition } from '../../_base';

interface NotifiarrStatus {
  version: string;
  uptime: string;
  clientStatus: string;
  connectedServices: number;
}

export const tool: ToolDefinition = {
  name: 'notifiarr_status',
  integration: 'notifiarr',
  description:
    'Get Notifiarr client status — version, uptime, and connected services overview',
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
    ctx.log('Fetching Notifiarr client status...');

    const [versionData, statusData] = await Promise.all([
      client.get('/api/version'),
      client.get('/api/status'),
    ]);

    const status: NotifiarrStatus = {
      version: versionData?.version ?? versionData?.client?.version ?? 'Unknown',
      uptime: statusData?.uptime ?? statusData?.client?.uptime ?? 'Unknown',
      clientStatus: statusData?.status ?? statusData?.client?.status ?? 'Unknown',
      connectedServices:
        statusData?.services?.length ??
        statusData?.connectedServices ??
        0,
    };

    const lines = [
      `Version: ${status.version}`,
      `Uptime: ${status.uptime}`,
      `Status: ${status.clientStatus}`,
      `Connected services: ${status.connectedServices}`,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: { status },
    };
  },
};
