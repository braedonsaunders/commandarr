import type { ToolDefinition } from '../../_base';

interface IrcNetwork {
  id: number;
  name: string;
  connected: boolean;
  enabled: boolean;
  server: string;
  channels: string[];
}

export const tool: ToolDefinition = {
  name: 'autobrr_irc_status',
  integration: 'autobrr',
  description:
    'Check Autobrr IRC network connections — shows each network, connection status, server, and channels',
  parameters: {
    type: 'object',
    properties: {},
  },
  ui: {
    category: 'Connectivity',
    dangerLevel: 'low',
    testable: true,
  },
  async handler(_params, ctx) {
    const client = ctx.getClient('autobrr');
    ctx.log('Fetching Autobrr IRC status...');

    const results = await client.get('/api/irc');

    if (!Array.isArray(results) || results.length === 0) {
      return {
        success: true,
        message: 'No IRC networks configured',
        data: { networks: [] },
      };
    }

    const networks: IrcNetwork[] = results.map((n: any) => ({
      id: n.id ?? 0,
      name: n.name ?? 'Unknown',
      connected: n.connected ?? false,
      enabled: n.enabled ?? false,
      server: n.server ?? n.addr ?? 'unknown',
      channels: Array.isArray(n.channels)
        ? n.channels.map((c: any) => c.name ?? c)
        : [],
    }));

    const connectedCount = networks.filter((n) => n.connected).length;
    const enabledCount = networks.filter((n) => n.enabled).length;

    const summary = networks
      .map(
        (n) =>
          `- ${n.name} (ID: ${n.id}): ${n.connected ? 'CONNECTED' : 'DISCONNECTED'}, ${n.enabled ? 'enabled' : 'disabled'}, server: ${n.server}, channels: ${n.channels.length > 0 ? n.channels.join(', ') : 'none'}`,
      )
      .join('\n');

    return {
      success: true,
      message: `IRC Networks: ${connectedCount}/${enabledCount} enabled connected (${networks.length} total)\n${summary}`,
      data: { networks, connectedCount, enabledCount, totalCount: networks.length },
    };
  },
};
