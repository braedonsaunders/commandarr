import type { ToolDefinition } from '../../_base';
import { parseXmlElements } from '../client';

export const tool: ToolDefinition = {
  name: 'plex_devices',
  integration: 'plex',
  description: 'List all registered Plex client devices with their last activity',
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
    ctx.log('Fetching registered devices...');

    const response = await client.get('/devices');

    interface DeviceInfo {
      id: string;
      name: string;
      product: string;
      platform: string;
      platformVersion: string;
      clientIdentifier: string;
      lastSeenAt: string;
    }

    const devices: DeviceInfo[] = [];

    if (response.MediaContainer) {
      const items = response.MediaContainer.Device ?? [];
      const deviceArray = Array.isArray(items) ? items : [items];

      for (const d of deviceArray) {
        if (!d) continue;
        devices.push({
          id: d.id ?? '',
          name: d.name ?? 'Unknown',
          product: d.product ?? '',
          platform: d.platform ?? '',
          platformVersion: d.platformVersion ?? '',
          clientIdentifier: d.clientIdentifier ?? '',
          lastSeenAt: d.lastSeenAt ?? '',
        });
      }
    } else if (response._xml) {
      const parsed = parseXmlElements(response._xml as string, 'Device');
      for (const attrs of parsed) {
        devices.push({
          id: attrs.id ?? '',
          name: attrs.name ?? 'Unknown',
          product: attrs.product ?? '',
          platform: attrs.platform ?? '',
          platformVersion: attrs.platformVersion ?? '',
          clientIdentifier: attrs.clientIdentifier ?? '',
          lastSeenAt: attrs.lastSeenAt ?? '',
        });
      }
    }

    if (devices.length === 0) {
      return { success: true, message: 'No registered devices found.', data: { devices: [] } };
    }

    const summary = devices
      .map((d) => {
        const lastSeen = d.lastSeenAt
          ? new Date(parseInt(d.lastSeenAt, 10) * 1000).toLocaleString()
          : 'unknown';
        return `- ${d.name} (${d.product} on ${d.platform}) — last seen: ${lastSeen}`;
      })
      .join('\n');

    return {
      success: true,
      message: `${devices.length} registered device(s):\n${summary}`,
      data: { devices },
    };
  },
};
