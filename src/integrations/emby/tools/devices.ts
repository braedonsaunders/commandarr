import type { ToolDefinition } from '../../_base';

interface DeviceInfo {
  Id: string;
  Name: string;
  AppName: string;
  AppVersion: string;
  LastUserName: string;
  LastUserId: string;
  DateLastActivity: string;
}

export const tool: ToolDefinition = {
  name: 'emby_devices',
  integration: 'emby',
  description: 'List all registered Emby client devices with their last activity',
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
    ctx.log('Fetching registered devices...');

    const response = await client.get('/Devices');
    const items: DeviceInfo[] = response?.Items ?? response ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, message: 'No registered devices found.', data: { devices: [] } };
    }

    const devices = items.map((d) => ({
      id: d.Id,
      name: d.Name,
      app: `${d.AppName} ${d.AppVersion ?? ''}`.trim(),
      lastUser: d.LastUserName,
      lastActive: d.DateLastActivity,
    }));

    const summary = devices
      .map(
        (d) =>
          `- ${d.name} (${d.app}) — last used by ${d.lastUser} on ${new Date(d.lastActive).toLocaleString()}`,
      )
      .join('\n');

    return {
      success: true,
      message: `${devices.length} registered device(s):\n${summary}`,
      data: { devices },
    };
  },
};
