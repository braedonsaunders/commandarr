import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'plex_health_check',
  integration: 'plex',
  description: 'Check if Plex Media Server is responding and get server info',
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
    const client = ctx.getClient('plex');
    ctx.log('Checking Plex server health...');

    const response = await client.get('/identity');

    // Handle both JSON and XML responses
    let serverName = 'Unknown';
    let version = 'Unknown';
    let machineId = 'Unknown';

    if (response.MediaContainer) {
      serverName = response.MediaContainer.machineIdentifier ?? 'Unknown';
      version = response.MediaContainer.version ?? 'Unknown';
    } else if (response._xml) {
      const xml = response._xml as string;
      const identityMatch = xml.match(/machineIdentifier="([^"]*)"/);
      const versionMatch = xml.match(/version="([^"]*)"/);
      const nameMatch = xml.match(/friendlyName="([^"]*)"/);
      machineId = identityMatch?.[1] ?? 'Unknown';
      version = versionMatch?.[1] ?? 'Unknown';
      serverName = nameMatch?.[1] ?? machineId;
    }

    return {
      success: true,
      message: `Plex server "${serverName}" is online (v${version})`,
      data: { serverName, version, machineId },
    };
  },
};
