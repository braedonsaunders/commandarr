import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tailscale_routes',
  integration: 'tailscale',
  description:
    'List all advertised and enabled subnet routes across your tailnet. Important for users who advertise their media server subnet so remote devices can reach local services like Plex, Sonarr, or Radarr.',
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
    ctx.log('Fetching subnet routes for all devices...');

    const response = await client.get('/api/v2/tailnet/{tailnet}/devices');
    const devices: any[] = response.devices ?? [];

    if (devices.length === 0) {
      return {
        success: true,
        message: 'No devices found in your tailnet.',
        data: { deviceRoutes: [] },
      };
    }

    const deviceRoutes: {
      name: string;
      id: string;
      os: string;
      online: boolean;
      advertisedRoutes: string[];
      enabledRoutes: string[];
    }[] = [];

    const now = Date.now();

    for (const device of devices) {
      const deviceId = device.id ?? device.nodeId;
      if (!deviceId) continue;

      try {
        const routeData = await client.get(`/api/v2/device/${deviceId}/routes`);

        const advertised: string[] = (routeData.advertisedRoutes ?? []).map(
          (r: any) => (typeof r === 'string' ? r : r?.prefix ?? String(r)),
        );
        const enabled: string[] = (routeData.enabledRoutes ?? []).map(
          (r: any) => (typeof r === 'string' ? r : r?.prefix ?? String(r)),
        );

        // Only include devices that have routes
        if (advertised.length > 0 || enabled.length > 0) {
          const lastSeen = device.lastSeen ?? '';
          const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;

          deviceRoutes.push({
            name: device.name ?? device.hostname ?? 'unknown',
            id: deviceId,
            os: device.os ?? 'unknown',
            online: now - lastSeenMs < 5 * 60 * 1000,
            advertisedRoutes: advertised,
            enabledRoutes: enabled,
          });
        }
      } catch {
        // Skip devices where we can't fetch routes
        continue;
      }
    }

    if (deviceRoutes.length === 0) {
      return {
        success: true,
        message:
          'No subnet routes are advertised on any device. To advertise a route, use `tailscale set --advertise-routes=192.168.1.0/24` on the device.',
        data: { deviceRoutes: [] },
      };
    }

    const lines: string[] = [
      `Found ${deviceRoutes.length} device(s) advertising routes:`,
      '',
    ];

    for (const dr of deviceRoutes) {
      const status = dr.online ? 'ONLINE' : 'OFFLINE';
      lines.push(`${dr.name} (${dr.os}) - ${status}:`);

      for (const route of dr.advertisedRoutes) {
        const isEnabled = dr.enabledRoutes.includes(route);
        const isExitNode = route === '0.0.0.0/0' || route === '::/0';
        const label = isExitNode ? '(exit node)' : '';
        lines.push(
          `  ${isEnabled ? '[ENABLED]' : '[PENDING]'} ${route} ${label}`.trimEnd(),
        );
      }

      // Check for enabled routes not in advertised (shouldn't happen, but be safe)
      for (const route of dr.enabledRoutes) {
        if (!dr.advertisedRoutes.includes(route)) {
          lines.push(`  [ENABLED] ${route}`);
        }
      }

      lines.push('');
    }

    const totalAdvertised = deviceRoutes.reduce(
      (sum, dr) => sum + dr.advertisedRoutes.length,
      0,
    );
    const totalEnabled = deviceRoutes.reduce(
      (sum, dr) => sum + dr.enabledRoutes.length,
      0,
    );

    lines.push(
      `Total: ${totalAdvertised} advertised route(s), ${totalEnabled} enabled route(s)`,
    );

    return {
      success: true,
      message: lines.join('\n'),
      data: { deviceRoutes, totalAdvertised, totalEnabled },
    };
  },
};
