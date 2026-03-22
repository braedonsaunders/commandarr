import type { ToolDefinition } from '../../_base';

export const tool: ToolDefinition = {
  name: 'tailscale_exit_nodes',
  integration: 'tailscale',
  description:
    'List available Tailscale exit nodes and their status. Exit nodes route all traffic through a specific device, useful for routing media traffic or accessing geo-restricted content.',
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
    ctx.log('Fetching exit node information...');

    const response = await client.get('/api/v2/tailnet/{tailnet}/devices');
    const devices: any[] = response.devices ?? [];

    // Exit nodes are devices that advertise 0.0.0.0/0 and ::/0 routes
    // We need to check each device's routes
    const exitNodes: {
      id: string;
      name: string;
      hostname: string;
      os: string;
      online: boolean;
      lastSeen: string;
      addresses: string[];
      allowedExitNode: boolean;
    }[] = [];

    const now = Date.now();

    for (const device of devices) {
      const deviceId = device.id ?? device.nodeId;
      if (!deviceId) continue;

      try {
        const routeData = await client.get(`/api/v2/device/${deviceId}/routes`);
        const routes: any[] = routeData.advertisedRoutes ?? routeData.routes ?? [];

        const advertisesExitNode = routes.some(
          (r: any) =>
            r === '0.0.0.0/0' ||
            r === '::/0' ||
            r?.prefix === '0.0.0.0/0' ||
            r?.prefix === '::/0',
        );

        // Also check enabledRoutes for active exit nodes
        const enabledRoutes: any[] = routeData.enabledRoutes ?? [];
        const exitNodeEnabled = enabledRoutes.some(
          (r: any) =>
            r === '0.0.0.0/0' ||
            r === '::/0' ||
            r?.prefix === '0.0.0.0/0' ||
            r?.prefix === '::/0',
        );

        if (advertisesExitNode || exitNodeEnabled) {
          const lastSeen = device.lastSeen ?? '';
          const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;

          exitNodes.push({
            id: deviceId,
            name: device.name ?? device.hostname ?? 'unknown',
            hostname: device.hostname ?? 'unknown',
            os: device.os ?? 'unknown',
            online: now - lastSeenMs < 5 * 60 * 1000,
            lastSeen,
            addresses: device.addresses ?? [],
            allowedExitNode: exitNodeEnabled,
          });
        }
      } catch {
        // Skip devices where we can't fetch routes (permissions, etc.)
        continue;
      }
    }

    if (exitNodes.length === 0) {
      return {
        success: true,
        message:
          'No exit nodes found in your tailnet. To use an exit node, enable it on a device with `tailscale set --advertise-exit-node`.',
        data: { exitNodes: [] },
      };
    }

    const lines = exitNodes.map((n) => {
      const status = n.online ? 'ONLINE' : 'OFFLINE';
      const enabled = n.allowedExitNode ? 'enabled' : 'advertised only';
      const ip = n.addresses.length > 0 ? n.addresses[0] : 'no IP';
      return `- ${n.name} (${n.os}) - ${status} - ${ip} - ${enabled}`;
    });

    const onlineCount = exitNodes.filter((n) => n.online).length;

    return {
      success: true,
      message: [
        `Found ${exitNodes.length} exit node(s) -- ${onlineCount} online:`,
        '',
        ...lines,
      ].join('\n'),
      data: { exitNodes },
    };
  },
};
