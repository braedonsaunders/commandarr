import type { ToolDefinition } from '../../_base';

interface TailscaleDevice {
  id: string;
  name: string;
  hostname: string;
  os: string;
  addresses: string[];
  lastSeen: string;
  online: boolean;
  authorized: boolean;
  tags?: string[];
  keyExpiryDisabled: boolean;
}

export const tool: ToolDefinition = {
  name: 'tailscale_status',
  integration: 'tailscale',
  description:
    'Get overall tailnet status: list all devices with their online/offline status, last seen time, OS, and IP addresses. Use this to check if your Plex server or other media devices are reachable.',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Network',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('tailscale');
    ctx.log('Fetching tailnet device list...');

    const response = await client.get('/api/v2/tailnet/{tailnet}/devices');
    const rawDevices: any[] = response.devices ?? [];

    if (rawDevices.length === 0) {
      return {
        success: true,
        message: 'No devices found in your tailnet.',
        data: { devices: [], totalCount: 0, onlineCount: 0 },
      };
    }

    const now = Date.now();
    const devices: TailscaleDevice[] = rawDevices.map((d) => {
      const lastSeen = d.lastSeen ?? '';
      const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
      // Consider a device online if seen within the last 5 minutes
      const online = now - lastSeenMs < 5 * 60 * 1000;

      return {
        id: d.id ?? d.nodeId ?? 'unknown',
        name: d.name ?? d.hostname ?? 'unknown',
        hostname: d.hostname ?? 'unknown',
        os: d.os ?? 'unknown',
        addresses: d.addresses ?? [],
        lastSeen,
        online,
        authorized: d.authorized ?? false,
        tags: d.tags,
        keyExpiryDisabled: d.keyExpiryDisabled ?? false,
      };
    });

    const onlineCount = devices.filter((d) => d.online).length;
    const offlineCount = devices.length - onlineCount;

    const formatLastSeen = (iso: string): string => {
      if (!iso) return 'never';
      const diff = now - new Date(iso).getTime();
      if (diff < 60_000) return 'just now';
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      return `${Math.floor(diff / 86_400_000)}d ago`;
    };

    const lines = devices.map((d) => {
      const status = d.online ? 'ONLINE' : 'OFFLINE';
      const ip = d.addresses.length > 0 ? d.addresses[0] : 'no IP';
      const tags = d.tags && d.tags.length > 0 ? ` [${d.tags.join(', ')}]` : '';
      return `- ${d.name} (${d.os}) - ${status} - ${ip} - last seen ${formatLastSeen(d.lastSeen)}${tags}`;
    });

    const summary = [
      `Tailnet: ${devices.length} device(s) -- ${onlineCount} online, ${offlineCount} offline`,
      '',
      ...lines,
    ].join('\n');

    return {
      success: true,
      message: summary,
      data: {
        devices,
        totalCount: devices.length,
        onlineCount,
        offlineCount,
      },
    };
  },
};
