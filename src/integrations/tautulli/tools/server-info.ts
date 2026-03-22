import type { ToolDefinition } from '../../_base';

interface ServerInfo {
  serverName: string;
  version: string;
  platform: string;
  platformVersion: string;
  updateAvailable: boolean;
  updateVersion?: string;
}

export const tool: ToolDefinition = {
  name: 'tautulli_server_info',
  integration: 'tautulli',
  description: 'Get Plex Media Server details reported by Tautulli',
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
    const client = ctx.getClient('tautulli');
    ctx.log('Fetching Plex server info...');

    const data = await client.get('get_server_info');

    if (!data) {
      return {
        success: false,
        message: 'Unable to retrieve server info from Tautulli',
      };
    }

    const info: ServerInfo = {
      serverName: data.pms_name ?? 'Unknown',
      version: data.pms_version ?? 'Unknown',
      platform: data.pms_platform ?? 'Unknown',
      platformVersion: data.pms_plat_version ?? 'Unknown',
      updateAvailable: Boolean(data.pms_update_available),
      updateVersion: data.pms_update_version ?? undefined,
    };

    const lines = [
      `Server: ${info.serverName}`,
      `Version: ${info.version}`,
      `Platform: ${info.platform} ${info.platformVersion}`,
      `Update available: ${info.updateAvailable ? `Yes (${info.updateVersion})` : 'No'}`,
    ];

    return {
      success: true,
      message: lines.join('\n'),
      data: { serverInfo: info },
    };
  },
};
