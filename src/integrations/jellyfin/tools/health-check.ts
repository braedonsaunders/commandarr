import type { ToolDefinition } from '../../_base';

interface SystemInfo {
  ServerName: string;
  Version: string;
  OperatingSystem: string;
  OperatingSystemDisplayName: string;
  SystemArchitecture: string;
  Id: string;
}

export const tool: ToolDefinition = {
  name: 'jellyfin_health_check',
  integration: 'jellyfin',
  description: 'Check Jellyfin server health and system info',
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
    const client = ctx.getClient('jellyfin');
    ctx.log('Checking Jellyfin system info...');

    const info: SystemInfo = await client.get('/System/Info');

    return {
      success: true,
      message: `Jellyfin server "${info.ServerName}" is online — v${info.Version} on ${info.OperatingSystemDisplayName ?? info.OperatingSystem} (${info.SystemArchitecture})`,
      data: {
        serverName: info.ServerName,
        version: info.Version,
        os: info.OperatingSystemDisplayName ?? info.OperatingSystem,
        architecture: info.SystemArchitecture,
        serverId: info.Id,
      },
    };
  },
};
