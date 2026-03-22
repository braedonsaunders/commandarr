import type { ToolDefinition } from '../../_base';

interface SystemInfo {
  ServerName: string;
  Version: string;
  OperatingSystem: string;
  OperatingSystemDisplayName: string;
  SystemArchitecture: string;
  LocalAddress: string;
  Id: string;
}

export const tool: ToolDefinition = {
  name: 'emby_health_check',
  integration: 'emby',
  description: 'Check Emby server health and system info',
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
    const client = ctx.getClient('emby');
    ctx.log('Checking Emby system info...');

    const info: SystemInfo = await client.get('/System/Info');

    return {
      success: true,
      message: `Emby server "${info.ServerName}" is online — v${info.Version} on ${info.OperatingSystemDisplayName ?? info.OperatingSystem} (${info.SystemArchitecture}), local address: ${info.LocalAddress}`,
      data: {
        serverName: info.ServerName,
        version: info.Version,
        os: info.OperatingSystemDisplayName ?? info.OperatingSystem,
        architecture: info.SystemArchitecture,
        localAddress: info.LocalAddress,
        serverId: info.Id,
      },
    };
  },
};
