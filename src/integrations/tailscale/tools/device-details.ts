import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tailscale_device_details',
  integration: 'tailscale',
  description:
    'Get detailed information about a specific Tailscale device by name or ID. Shows addresses, authorized status, advertised routes, tags, key expiry, and whether an update is available.',
  parameters: {
    type: 'object',
    properties: {
      device: {
        type: 'string',
        description:
          'Device name (hostname) or device ID. If a name is provided, it will be matched against the device list.',
      },
    },
    required: ['device'],
  },
  ui: {
    category: 'Network',
    dangerLevel: 'low',
    testable: false,
  },
  async handler(params, ctx) {
    const { device } = params;
    if (!device || typeof device !== 'string') {
      return { success: false, message: 'Device name or ID is required.' };
    }

    const client = ctx.getClient('tailscale');
    ctx.log(`Looking up device: ${device}`);

    // First try to find the device by listing all devices and matching by name or ID
    const listResponse = await client.get('/api/v2/tailnet/{tailnet}/devices');
    const devices: any[] = listResponse.devices ?? [];

    const searchLower = device.toLowerCase();
    const match = devices.find(
      (d) =>
        d.id === device ||
        d.nodeId === device ||
        (d.name ?? '').toLowerCase().includes(searchLower) ||
        (d.hostname ?? '').toLowerCase() === searchLower,
    );

    if (!match) {
      const available = devices
        .slice(0, 10)
        .map((d: any) => d.name ?? d.hostname ?? d.id)
        .join(', ');
      return {
        success: false,
        message: `Device "${device}" not found. Available devices: ${available}`,
      };
    }

    // Fetch detailed info using the device ID
    const deviceId = match.id ?? match.nodeId;
    const detail = await client.get(`/api/v2/device/${deviceId}`);

    const now = Date.now();
    const lastSeen = detail.lastSeen ?? match.lastSeen ?? '';
    const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
    const online = now - lastSeenMs < 5 * 60 * 1000;

    const keyExpiry = detail.keyExpiryDisabled
      ? 'Key expiry disabled'
      : detail.expires
        ? `Expires ${detail.expires}`
        : 'Unknown';

    const addresses = detail.addresses ?? match.addresses ?? [];
    const tags = detail.tags ?? match.tags ?? [];
    const os = detail.os ?? match.os ?? 'unknown';
    const clientVersion = detail.clientVersion ?? 'unknown';
    const updateAvailable = detail.updateAvailable ?? false;
    const authorized = detail.authorized ?? match.authorized ?? false;
    const isExternal = detail.isExternal ?? false;
    const machineKey = detail.machineKey ?? '';
    const nodeKey = detail.nodeKey ?? '';
    const created = detail.created ?? '';

    const lines = [
      `Device: ${detail.name ?? match.name ?? match.hostname}`,
      `Hostname: ${detail.hostname ?? match.hostname ?? 'unknown'}`,
      `Status: ${online ? 'ONLINE' : 'OFFLINE'}`,
      `OS: ${os}`,
      `Client Version: ${clientVersion}${updateAvailable ? ' (UPDATE AVAILABLE)' : ''}`,
      `Authorized: ${authorized ? 'Yes' : 'No'}`,
      `External: ${isExternal ? 'Yes' : 'No'}`,
      `Addresses: ${addresses.join(', ') || 'none'}`,
      `Tags: ${tags.length > 0 ? tags.join(', ') : 'none'}`,
      `Key: ${keyExpiry}`,
      `Last Seen: ${lastSeen || 'never'}`,
      `Created: ${created || 'unknown'}`,
    ];

    if (machineKey) lines.push(`Machine Key: ${machineKey.slice(0, 20)}...`);
    if (nodeKey) lines.push(`Node Key: ${nodeKey.slice(0, 20)}...`);

    return {
      success: true,
      message: lines.join('\n'),
      data: {
        id: deviceId,
        name: detail.name ?? match.name,
        hostname: detail.hostname ?? match.hostname,
        online,
        os,
        clientVersion,
        updateAvailable,
        authorized,
        isExternal,
        addresses,
        tags,
        keyExpiryDisabled: detail.keyExpiryDisabled ?? false,
        expires: detail.expires,
        lastSeen,
        created,
      },
    };
  },
};
